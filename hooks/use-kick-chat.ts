"use client"

import { useEffect, useRef, useState } from "react"
import {
  KICK_DEFAULT_USER_COLOR,
  KICK_PUSHER_URL,
  isModOrBroadcaster,
  type KickChatPayload,
  type KickMessage,
} from "@/lib/kick-chat"

export type KickChatStatus = "idle" | "connecting" | "connected" | "error"

type Options = {
  /** Kick channel slug, e.g. "trinidoslots". */
  slug: string
  /** How many messages to retain; older ones are dropped as they scroll away. */
  limit?: number
  /** Called for every message, before it lands in state. */
  onMessage?: (message: KickMessage) => void
}

// An OBS browser source runs unattended for hours, so a dropped socket has to
// heal itself — the admin page can rely on someone noticing and clicking, this
// cannot. Backs off to avoid hammering Kick when the channel is simply offline.
const RECONNECT_BASE_MS = 2_000
const RECONNECT_MAX_MS = 30_000

export function useKickChat({ slug, limit = 100, onMessage }: Options) {
  const [messages, setMessages] = useState<KickMessage[]>([])
  const [status, setStatus] = useState<KickChatStatus>("idle")
  const socketRef = useRef<WebSocket | null>(null)
  const idCounterRef = useRef(0)
  const attemptsRef = useRef(0)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    const trimmedSlug = slug.trim()
    if (!trimmedSlug) return

    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    const scheduleReconnect = () => {
      if (cancelled) return
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptsRef.current, RECONNECT_MAX_MS)
      attemptsRef.current += 1
      reconnectTimer = setTimeout(connect, delay)
    }

    const connect = async () => {
      if (cancelled) return
      setStatus("connecting")

      let chatroomId: number
      try {
        const response = await fetch(`/api/kick/chatroom?slug=${encodeURIComponent(trimmedSlug)}`)
        const data = await response.json()
        if (!response.ok || typeof data.chatroomId !== "number") {
          throw new Error(data.error || "Failed to resolve chatroom id")
        }
        chatroomId = data.chatroomId
      } catch {
        if (cancelled) return
        setStatus("error")
        scheduleReconnect()
        return
      }

      if (cancelled) return

      const socket = new WebSocket(KICK_PUSHER_URL)
      socketRef.current = socket

      socket.onmessage = (event) => {
        let frame: { event?: string; data?: string }
        try {
          frame = JSON.parse(event.data)
        } catch {
          return // ignore malformed frames
        }

        if (frame.event === "pusher:connection_established") {
          socket.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: { channel: `chatrooms.${chatroomId}.v2` },
            }),
          )
          attemptsRef.current = 0
          setStatus("connected")
          return
        }

        if (frame.event !== "App\\Events\\ChatMessageEvent" || !frame.data) return

        let payload: KickChatPayload
        try {
          payload = JSON.parse(frame.data)
        } catch {
          return
        }

        idCounterRef.current += 1
        const message: KickMessage = {
          id: payload.id ?? `local-${idCounterRef.current}`,
          kickId: payload.sender?.id != null ? String(payload.sender.id) : "",
          username: payload.sender?.username ?? "unknown",
          content: payload.content ?? "",
          color: payload.sender?.identity?.color || KICK_DEFAULT_USER_COLOR,
          badges: payload.sender?.identity?.badges ?? [],
          isMod: isModOrBroadcaster(payload.sender?.identity?.badges),
          receivedAt: Date.now(),
        }

        onMessageRef.current?.(message)
        setMessages((current) => {
          const next = [...current, message]
          return next.length > limit ? next.slice(next.length - limit) : next
        })
      }

      socket.onerror = () => setStatus("error")
      socket.onclose = () => {
        if (cancelled || socketRef.current !== socket) return
        setStatus("error")
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      cancelled = true
      clearTimeout(reconnectTimer)
      const socket = socketRef.current
      socketRef.current = null
      socket?.close()
    }
  }, [slug, limit])

  return { messages, status }
}
