"use client"

import { useCallback, useEffect, useRef } from "react"
import { RECORDER_FLUSH_MS, type Chatter } from "@/lib/points-activity"
import type { KickMessage } from "@/lib/kick-chat"

/**
 * Records who is talking, from the page that is already reading chat.
 *
 * Kick chat arrives over a WebSocket and a serverless function cannot hold one
 * open, so the recorder is the browser: in practice the OBS source, which runs
 * unattended for the whole stream. Nothing is recorded while no such page is
 * open, which the admin panel shows rather than hides.
 *
 * One row per person per flush, not one request per message — a busy chat is
 * several messages a second and that would be a request storm for information
 * that only has to be accurate to the minute.
 */

type Options = {
  /** The recorder token from the page URL. Without it nothing is sent. */
  token: string | null
  flushMs?: number
}

export type RecorderHandle = {
  /** Hand this to useKickChat's onMessage. */
  observe: (message: KickMessage) => void
}

export function useChatRecorder({ token, flushMs = RECORDER_FLUSH_MS }: Options): RecorderHandle {
  // Buffered between flushes: kick id -> when they last spoke and how often.
  const pendingRef = useRef(new Map<string, { username: string; at: number; messages: number }>())
  const tokenRef = useRef(token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  const observe = useCallback((message: KickMessage) => {
    // A payload without a sender id cannot be matched to an account, so
    // recording it would only inflate the count of people who get nothing.
    if (!message.kickId) return

    const pending = pendingRef.current
    const existing = pending.get(message.kickId)

    if (existing) {
      existing.at = message.receivedAt
      existing.username = message.username
      existing.messages += 1
    } else {
      pending.set(message.kickId, { username: message.username, at: message.receivedAt, messages: 1 })
    }
  }, [])

  useEffect(() => {
    if (!token) return

    let cancelled = false

    const flush = async () => {
      const pending = pendingRef.current
      if (pending.size === 0) return

      // Taken before the request so messages arriving mid-flight land in the
      // next batch instead of being dropped when this one succeeds.
      const batch = [...pending.entries()]
      pending.clear()

      const now = Date.now()
      const chatters: Chatter[] = batch.map(([kickId, entry]) => ({
        kickId,
        username: entry.username,
        // Elapsed time, not a clock reading: the server dates the row itself,
        // so a wrong system clock on the streaming PC cannot shift the window.
        agoMs: Math.max(0, now - entry.at),
        messages: entry.messages,
      }))

      try {
        const response = await fetch("/api/chat/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenRef.current, chatters }),
        })

        if (!response.ok) {
          const detail = await response.json().catch(() => ({}))
          // Loud on purpose. The previous version of this feature logged
          // nothing and looked healthy while recording nothing at all.
          console.error("[recorder] activity not recorded:", response.status, detail.error ?? "")
        }
      } catch (error) {
        console.error("[recorder] could not reach /api/chat/activity:", error)
      }
    }

    const timer = setInterval(() => {
      if (!cancelled) void flush()
    }, flushMs)

    return () => {
      cancelled = true
      clearInterval(timer)
      // Best effort on unmount: an OBS source being closed mid-window should
      // not lose the last few seconds of chat.
      void flush()
    }
  }, [token, flushMs])

  return { observe }
}
