"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Crown, Trophy, Users, Play, Square, Shuffle, Tv, XCircle, X, ChevronDown, History, Pencil } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { RecordWinDialog, WinnerName } from "@/components/admin/record-win-dialog"

const PUSHER_URL = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false"
const MOD_TYPES = new Set(["moderator", "broadcaster"])
const FINISHED_DISPLAY_SECONDS = 20
const DEFAULT_SLUG = "trinidoslots"
// The OBS widget halts on the stationary wheel for ROLL_START_DELAY_SECONDS before it
// starts scrolling, then halts again on the landed winner for WINNER_HALT_SECONDS before
// flipping to the "finished" trophy card. These must match the widget's own delay so the
// admin-side "finished" timeout fires at the same moment the widget's animation settles.
const ROLL_START_DELAY_SECONDS = 2
const WINNER_HALT_SECONDS = 3

// Kick sends emotes inline in chat content as raw placeholder codes, e.g.
// "[emote:553704:trainwreckstvNodders]" — not just the emote's name. A keyword
// match must compare against this exact code, so we let the admin click an
// emote straight out of the live feed to capture it instead of guessing the syntax.
const EMOTE_CODE_REGEX = /\[(?:emote|emoji):\d+:[^\]]+\]/g
const EMOTE_CODE_SINGLE = /^\[(?:emote|emoji):\d+:([^\]]+)\]$/

function emoteFriendlyName(code: string) {
  const match = code.match(EMOTE_CODE_SINGLE)
  return match ? match[1] : code
}

// Friendly label for the keyword: shows just the emote name if the keyword is
// an emote code, otherwise the keyword text as typed.
function formatKeywordForDisplay(keyword: string) {
  const trimmed = keyword.trim()
  return trimmed ? emoteFriendlyName(trimmed) : trimmed
}

// Splits message content on emote codes so each emote can be rendered as a
// clickable pill that fills the keyword field with its exact raw code.
function renderMessageContent(content: string, onUseEmote: (code: string) => void) {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  const regex = new RegExp(EMOTE_CODE_REGEX)
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{content.slice(lastIndex, match.index)}</span>)
    }
    const code = match[0]
    nodes.push(
      <button
        key={key++}
        type="button"
        onClick={() => onUseEmote(code)}
        title={`Use :${emoteFriendlyName(code)}: as the entry keyword`}
        className="mx-0.5 cursor-pointer rounded bg-[#53fc18]/15 px-1.5 py-0.5 text-xs font-semibold text-[#53fc18] hover:bg-[#53fc18]/25"
      >
        :{emoteFriendlyName(code)}:
      </button>,
    )
    lastIndex = match.index + code.length
  }

  if (lastIndex < content.length) {
    nodes.push(<span key={key++}>{content.slice(lastIndex)}</span>)
  }

  return nodes
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "error"

type ChatMessage = {
  id: string
  username: string
  content: string
  isMod: boolean
}

type Badge = { type: string }

type KickChatPayload = {
  sender?: { username?: string; identity?: { badges?: Badge[] } }
  content?: string
}

function isModOrBroadcaster(badges: Badge[] | undefined) {
  return (badges ?? []).some((badge) => MOD_TYPES.has(badge.type))
}

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function GiveawayAdminPage() {
  const [slug, setSlug] = useState(DEFAULT_SLUG)
  const [slugInput, setSlugInput] = useState(DEFAULT_SLUG)
  const [keyword, setKeyword] = useState("!enter")
  const [rollDuration, setRollDuration] = useState(6)
  const [status, setStatus] = useState<ConnectionStatus>("idle")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [channelAvatar, setChannelAvatar] = useState<string | null>(null)
  // Once connected, the input/Go/X row morphs into a compact "connected" pill
  // (avatar + name + status dot + edit pencil). The pencil brings the input back.
  const [isEditingChannel, setIsEditingChannel] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [entrants, setEntrants] = useState<Set<string>>(new Set())
  const [avatars, setAvatars] = useState<Record<string, string | null>>({})
  const [winner, setWinner] = useState<string | null>(null)
  // Controls only the "Current winner" card below — kept separate from `winner` (which is
  // set immediately so entry highlighting/round-exclusion/widget sync stay correct) so the
  // admin's own card rolls in suspense too, instead of spoiling the name before the OBS
  // widget lands on it.
  const [revealPhase, setRevealPhase] = useState<"idle" | "rolling" | "revealed">("idle")
  const [pastWinners, setPastWinners] = useState<string[]>([])
  // Clicking a winner opens the win log against their name.
  const [logWinner, setLogWinner] = useState<string | null>(null)
  // Entrants who have already won during the CURRENT round (since Start, cleared only
  // by Start or End) — kept out of the draw pool so nobody wins twice in one round.
  const [roundWinners, setRoundWinners] = useState<Set<string>>(new Set())
  const [obsExpanded, setObsExpanded] = useState(false)
  // When the current round was started (set on Start, cleared only on End — stopping
  // entries or rolling a winner does NOT clear it, since the round is still "active").
  // Drives the "Giveaway active for MM:SS" indicator.
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const socketRef = useRef<WebSocket | null>(null)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const idCounterRef = useRef(0)
  const keywordRef = useRef(keyword)
  const isOpenRef = useRef(isOpen)
  const entrantsRef = useRef<Set<string>>(new Set())
  const supabaseRef = useRef(createClient())
  const finishedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoConnectedRef = useRef(false)
  // Caches in-flight/resolved avatar fetches by username so drawWinner can await every
  // entrant's avatar before rolling, instead of racing the OBS widget's animation.
  const avatarPromisesRef = useRef<Map<string, Promise<void>>>(new Map())
  // Re-entrancy guard for drawWinner — checked synchronously so rapid repeat clicks
  // during a roll can't overlap and corrupt the in-flight timers/refs (the button's
  // `disabled` prop alone isn't enough since it only updates after a re-render).
  const isRollingRef = useRef(false)
  // Bumped at the start of every roll. The "finished" and "revert to open/closed" timers
  // below capture the id they were scheduled for and no-op if a newer roll has since
  // started — this is what actually prevents a previous roll's pending timer from firing
  // mid-setup of the next roll and overwriting the widget with the stale winner/status
  // (which is what caused the widget to "not roll" / land on the wrong avatar).
  const rollIdRef = useRef(0)

  // Pushes the widget-facing state to Supabase so the OBS overlay (a separate
  // browser source) stays in sync with what the admin panel is doing.
  const syncWidgetState = useCallback(
    (patch: {
      status: "idle" | "open" | "closed" | "rolling" | "finished"
      keyword?: string
      entrants?: string[]
      entrant_avatars?: Record<string, string | null>
      winner?: string | null
      roll_duration_seconds?: number
      channel_slug?: string
      started_at?: string | null
    }) => {
      supabaseRef.current
        .from("giveaway_state")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1)
        .then(({ error }: { error: unknown }) => {
          if (error) console.error("[v0] Failed to sync giveaway widget state:", error)
        })
    },
    [],
  )

  useEffect(() => {
    keywordRef.current = keyword
  }, [keyword])

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    entrantsRef.current = entrants
  }, [entrants])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    return () => {
      socketRef.current?.close()
      if (finishedTimerRef.current) clearTimeout(finishedTimerRef.current)
    }
  }, [])

  const appendMessage = useCallback((username: string, content: string, isMod: boolean) => {
    idCounterRef.current += 1
    setMessages((current) => {
      const next = [...current, { id: `${idCounterRef.current}`, username, content, isMod }]
      return next.length > 200 ? next.slice(next.length - 200) : next
    })
  }, [])

  // Fetches and caches a single entrant's Kick avatar as soon as they enter, so the
  // OBS widget never has to fetch avatars itself at roll time (which was flaky/slow
  // mid-animation). Returns a promise so drawWinner can await it directly rather than
  // relying on the entry-time fetch having finished by the time the roll happens.
  // Deduped by a promise cache (not just the avatars map) — repeat calls for the same
  // username, even while a fetch is in flight, resolve to the same in-flight promise.
  const fetchAvatarFor = useCallback(
    (username: string): Promise<void> => {
      const key = username.toLowerCase()
      const cached = avatarPromisesRef.current.get(key)
      if (cached) return cached

      const promise = fetch(`/api/kick/avatar?username=${encodeURIComponent(key)}`)
        .then((response) => response.json())
        .then((data) => {
          const avatar = typeof data.avatar === "string" ? data.avatar : null
          setAvatars((latest) => {
            const next = { ...latest, [key]: avatar }
            syncWidgetState({ status: isOpenRef.current ? "open" : "closed", entrant_avatars: next })
            return next
          })
        })
        .catch(() => {
          setAvatars((latest) => ({ ...latest, [key]: null }))
        })

      avatarPromisesRef.current.set(key, promise)
      return promise
    },
    [syncWidgetState],
  )

  // The ONLY effect chat has on state: counting entries while the giveaway is open.
  // No chat message, from anyone, can start, stop, or draw the giveaway.
  // Duplicate entries are rejected here: the Set is keyed by lowercased username,
  // so a user typing the keyword multiple times only ever counts once per giveaway.
  const handleChatEntry = useCallback(
    (username: string, content: string) => {
      const trimmedContent = content.trim().toLowerCase()
      const trimmedKeyword = keywordRef.current.trim().toLowerCase()
      const open = isOpenRef.current
      const counted = open && trimmedContent === trimmedKeyword && trimmedKeyword.length > 0

      console.log("[v0] chat message:", content, "| counted as entry:", counted)

      if (counted) {
        setEntrants((current) => {
          if (current.has(username.toLowerCase())) return current // already entered — ignore duplicate
          const next = new Set(current)
          next.add(username.toLowerCase())
          // Fetch the entrant's avatar now, pre-roll, instead of at draw time.
          fetchAvatarFor(username)
          // Keep the OBS widget's entrant count live as people enter, not just at start/draw.
          syncWidgetState({ status: "open", entrants: Array.from(next) })
          return next
        })
      }
    },
    [syncWidgetState, fetchAvatarFor],
  )

  const connect = useCallback(
    async (targetSlug?: string) => {
      const trimmedSlug = (targetSlug ?? slugInput).trim()
      if (!trimmedSlug) return

      socketRef.current?.close()
      setMessages([])
      setSlug(trimmedSlug)
      setStatus("connecting")
      setStatusMessage(null)
      setChannelAvatar(null)

      // Fetch the channel's own avatar in parallel with resolving the chatroom, so it's
      // ready the instant the "connected" pill animates in — no pop-in.
      fetch(`/api/kick/avatar?username=${encodeURIComponent(trimmedSlug)}`)
        .then((response) => response.json())
        .then((data) => setChannelAvatar(typeof data.avatar === "string" ? data.avatar : null))
        .catch(() => setChannelAvatar(null))

      try {
        const response = await fetch(`/api/kick/chatroom?slug=${encodeURIComponent(trimmedSlug)}`)
        const data = await response.json()

        if (!response.ok || typeof data.chatroomId !== "number") {
          throw new Error(data.error || "Failed to resolve chatroom id")
        }

        const chatroomId = data.chatroomId
        const socket = new WebSocket(PUSHER_URL)
        socketRef.current = socket

        socket.onmessage = (event) => {
          try {
            const frame = JSON.parse(event.data)

            if (frame.event === "pusher:connection_established") {
              socket.send(
                JSON.stringify({
                  event: "pusher:subscribe",
                  data: { channel: `chatrooms.${chatroomId}.v2` },
                }),
              )
              setStatus("connected")
              setIsEditingChannel(false)
              // Persist the connected channel so the combined OBS overlay widget knows
              // which chatroom to render its own live chat feed from.
              syncWidgetState({ status: isOpenRef.current ? "open" : "closed", channel_slug: trimmedSlug })
              return
            }

            if (frame.event === "App\\Events\\ChatMessageEvent") {
              const payload: KickChatPayload = JSON.parse(frame.data)
              const username = payload.sender?.username ?? "unknown"
              const content = payload.content ?? ""
              const isMod = isModOrBroadcaster(payload.sender?.identity?.badges)
              appendMessage(username, content, isMod)
              handleChatEntry(username, content)
            }
          } catch {
            // ignore malformed frames
          }
        }

        socket.onerror = () => {
          setStatus("error")
          setStatusMessage("WebSocket connection error")
          setIsEditingChannel(true)
        }

        socket.onclose = () => {
          setStatus((current) => (current === "connected" ? "error" : current))
        }
      } catch (error) {
        setStatus("error")
        setStatusMessage(error instanceof Error ? error.message : "Failed to connect")
        setIsEditingChannel(true)
      }
    },
    [slugInput, appendMessage, handleChatEntry, syncWidgetState],
  )

  // Auto-connect to the default Kick channel as soon as the page loads.
  useEffect(() => {
    if (autoConnectedRef.current) return
    autoConnectedRef.current = true
    connect(DEFAULT_SLUG)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, [])

  const disconnect = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
    setStatus("idle")
    setStatusMessage(null)
    setChannelAvatar(null)
    setIsEditingChannel(true)
  }, [])

  const startGiveaway = useCallback(() => {
    if (finishedTimerRef.current) clearTimeout(finishedTimerRef.current)
    setEntrants(new Set())
    setWinner(null)
    setRevealPhase("idle")
    setRoundWinners(new Set())
    setIsOpen(true)
    const now = Date.now()
    setStartedAt(now)
    setElapsedSeconds(0)
    syncWidgetState({
      status: "open",
      keyword,
      entrants: [],
      winner: null,
      roll_duration_seconds: rollDuration,
      started_at: new Date(now).toISOString(),
    })
  }, [keyword, rollDuration, syncWidgetState])

  // Stops entries only — the giveaway stays "active" with its entrant pool intact,
  // the widget switches to "Entries stopped / Awaiting giveaway roll".
  const stopEntries = useCallback(() => {
    setIsOpen(false)
    syncWidgetState({ status: "closed" })
  }, [syncWidgetState])

  // Fully ends the giveaway: clears entrants/winner and reverts the widget to
  // "No active giveaway". Use this to reset before starting a fresh round.
  const endGiveaway = useCallback(() => {
    if (finishedTimerRef.current) clearTimeout(finishedTimerRef.current)
    setIsOpen(false)
    setEntrants(new Set())
    setWinner(null)
    setRevealPhase("idle")
    setRoundWinners(new Set())
    setStartedAt(null)
    syncWidgetState({ status: "idle", entrants: [], winner: null, started_at: null })
  }, [syncWidgetState])

  // Ticks the "active for MM:SS" indicator once a second while a round is running.
  useEffect(() => {
    if (startedAt === null) return
    setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const drawWinner = useCallback(async () => {
    // Re-entrancy guard: checked synchronously, not via React state, so a burst of
    // clicks fired before the next render can't slip through and start a second roll
    // on top of one already in flight (which was corrupting the shared timers/refs
    // and made the animation "bug out" after the first winner).
    if (isRollingRef.current) return

    const pool = Array.from(entrantsRef.current)
    // A winner can't be redrawn in the same round — only entrants who haven't
    // won yet (since Start, cleared only by Start or End) are eligible.
    const eligible = pool.filter((name) => !roundWinners.has(name))
    if (eligible.length === 0) return

    isRollingRef.current = true

    // Cancel any timer left over from a previous roll (e.g. its pending 20s
    // "finished -> open/closed" revert) immediately, BEFORE the avatar-fetch await
    // below — clearing it only after the await left a race window where that stale
    // timer could fire mid-setup of this new roll and overwrite the widget's
    // status/winner in the database with the previous roll's winner. That's what
    // caused the widget to appear stuck and land on a different avatar than the
    // name actually shown.
    if (finishedTimerRef.current) clearTimeout(finishedTimerRef.current)
    rollIdRef.current += 1
    const rollId = rollIdRef.current

    const pickedWinner = eligible[Math.floor(Math.random() * eligible.length)]

    // Guarantee every entrant's avatar has resolved before the widget rolls — in the
    // common case this is already cached from entry time and resolves instantly, but
    // this closes the gap where a roll happens before a just-joined entrant's avatar
    // fetch has finished.
    await Promise.all(pool.map((name) => fetchAvatarFor(name)))

    // A newer roll started while we were awaiting avatars — abandon this one so it
    // can't clobber the roll that superseded it.
    if (rollIdRef.current !== rollId) return

    setWinner(pickedWinner)
    setRevealPhase("rolling")
    setRoundWinners((prev) => {
      const next = new Set(prev)
      next.add(pickedWinner)
      return next
    })

    // Flips the widget to "rolling" immediately so the (stationary) wheel appears the
    // instant Roll winner is clicked — the widget itself holds the wheel still for
    // ROLL_START_DELAY_SECONDS before it starts scrolling. The reel only shows
    // entrants still eligible this round — anyone who's already won is excluded so
    // they never appear spinning by (or being landed on) a second time.
    syncWidgetState({
      status: "rolling",
      keyword,
      entrants: eligible,
      winner: pickedWinner,
      roll_duration_seconds: rollDuration,
    })

    // Total sequence the widget plays out: start halt -> scroll -> land-on-winner halt.
    const totalSequenceMs = (ROLL_START_DELAY_SECONDS + rollDuration + WINNER_HALT_SECONDS) * 1000

    // The admin's own "Current winner" card reveals at the exact moment the widget
    // settles on the winner, so the admin doesn't spoil the name before the stream does.
    finishedTimerRef.current = setTimeout(() => {
      if (rollIdRef.current !== rollId) return
      setRevealPhase("revealed")
      // "Past winners" only records the win once it's actually revealed — recording it
      // the instant it was picked spoiled the name in the sidebar while the roll was
      // still spinning.
      setPastWinners((history) => [pickedWinner, ...history].slice(0, 20))
      // Unlock right as the winner is revealed — covers the full "spin + winner
      // animation" window the button should stay locked for, without also holding
      // it locked through the (much longer) finished-display period afterward.
      isRollingRef.current = false
      syncWidgetState({ status: "finished", entrants: eligible, winner: pickedWinner })
      finishedTimerRef.current = setTimeout(() => {
        if (rollIdRef.current !== rollId) return
        // Only fall back to idle if the round has actually been stopped —
        // otherwise return to the live open/closed state so the active keyword
        // (and the last-winner badge) keep showing instead of disappearing.
        syncWidgetState({
          status: isOpenRef.current ? "open" : "closed",
          keyword: keywordRef.current,
          winner: pickedWinner,
        })
      }, FINISHED_DISPLAY_SECONDS * 1000)
    }, totalSequenceMs)
  }, [keyword, rollDuration, syncWidgetState, roundWinners, fetchAvatarFor])

  const statusColor =
    status === "connected"
      ? "bg-[#53fc18]"
      : status === "connecting"
        ? "bg-amber-300 animate-pulse"
        : status === "error"
          ? "bg-red-400"
          : "bg-white/[0.10]"

  const entrantList = Array.from(entrants)
  const eligibleCount = entrantList.filter((name) => !roundWinners.has(name)).length

  return (
    <main className="hide-scrollbar min-h-screen overflow-y-auto bg-[#0B0B0D] px-4 py-6 text-white/90 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Kick Giveaway</h1>
            <p className="mt-1 text-sm text-white/30">
              Reading <span className="font-semibold text-white/60">{slug}</span>&apos;s chat directly in this tab.
            </p>
            {/* Active-round indicator — visible from Start until End, independent of
                whether entries are currently open or a roll is in progress. */}
            <AnimatePresence>
              {startedAt !== null && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#53fc18]/30 bg-[#53fc18]/10 px-3 py-1 text-xs font-semibold text-[#53fc18]"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#53fc18] opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-[#53fc18]" />
                  </span>
                  Giveaway active for {formatElapsed(elapsedSeconds)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Channel pill — click Go to (re)connect to a channel, X to disconnect. Once
              connected it morphs into a compact avatar+name pill; the pencil re-opens editing. */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="flex items-center gap-1.5 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.022] py-1 pl-1.5 pr-1.5"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {status === "connected" && !isEditingChannel ? (
                <motion.div
                  key="pill"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 pl-1"
                >
                  {channelAvatar ? (
                    <img
                      src={channelAvatar || "/placeholder.svg"}
                      alt=""
                      className="size-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-6 items-center justify-center rounded-full bg-white/[0.06]">
                      <Tv className="size-3.5 text-white/30" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-white">{slug}</span>
                  <span className="size-2 rounded-full bg-[#53fc18]" />
                  <button
                    onClick={() => {
                      setSlugInput(slug)
                      setIsEditingChannel(true)
                    }}
                    title="Change channel"
                    className="flex size-6 cursor-pointer items-center justify-center rounded-full text-white/30 hover:bg-white/[0.06] hover:text-white/60"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5 pl-1.5"
                >
                  <span className={`size-2 rounded-full ${statusColor}`} />
                  <input
                    value={slugInput}
                    onChange={(event) => setSlugInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") connect()
                    }}
                    placeholder="channel-slug"
                    className="w-32 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30"
                  />
                  <button
                    onClick={() => connect()}
                    className="cursor-pointer rounded-full bg-[#53fc18] px-3 py-1 text-xs font-bold text-[#0B0B0D] hover:bg-[#68ff34]"
                  >
                    Go
                  </button>
                  <button
                    onClick={disconnect}
                    title="Disconnect"
                    className="flex size-6 cursor-pointer items-center justify-center rounded-full text-white/30 hover:bg-white/[0.06] hover:text-white/60"
                  >
                    <X className="size-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {statusMessage && (
          <div className="mb-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm text-red-300">
            {statusMessage}
          </div>
        )}

        {/* Three-column layout: Entries · Keyword & controls · Live chat */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
          {/* Entries */}
          <section className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.022] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
                <Users className="size-3.5" /> Entries
              </span>
              <span className="rounded-full bg-[#53fc18]/15 px-2 py-0.5 text-xs font-bold text-[#53fc18]">
                {entrants.size}
              </span>
            </div>
            <div className="hide-scrollbar flex-1 space-y-1 overflow-y-auto lg:max-h-[600px]">
              {entrantList.length === 0 ? (
                <p className="py-10 text-center text-sm text-white/30">
                  {isOpen ? `Type ${formatKeywordForDisplay(keyword)} in chat to enter.` : "Entries are closed."}
                </p>
              ) : (
                entrantList.map((entrant) => (
                  <div
                    key={entrant}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                      winner === entrant
                        ? "bg-[#53fc18]/15 text-[#53fc18]"
                        : roundWinners.has(entrant)
                          ? "bg-white/[0.06]/30 text-white/30"
                          : "bg-white/[0.04] text-white/60"
                    }`}
                  >
                    <span className="truncate">{entrant}</span>
                    {roundWinners.has(entrant) && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/30">
                        Won
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Keyword, controls, winner */}
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.022] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/40">Keyword</span>
                <span className="font-semibold capitalize text-white/30">
                  {status}
                </span>
              </div>

              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="leave empty to enter everyone"
                className="mb-4 w-full rounded-lg border border-white/[0.10] bg-black/30 px-3 py-2.5 text-sm text-white/90 outline-none focus:border-[#53fc18]"
              />

              <label className="mb-5 flex items-center justify-between gap-3 text-sm font-semibold text-white/60">
                <span>Roll duration</span>
                <span className="flex items-center gap-2">
                  <input
                    type="range"
                    min={2}
                    max={20}
                    value={rollDuration}
                    onChange={(event) => setRollDuration(Number(event.target.value))}
                    className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-[#53fc18]"
                  />
                  <span className="w-10 text-right text-xs font-bold text-[#53fc18]">{rollDuration}s</span>
                </span>
              </label>

              <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
                <button
                  onClick={startGiveaway}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#53fc18] px-3 py-2 text-sm font-bold text-[#0B0B0D] hover:bg-[#68ff34]"
                >
                  <Play className="size-4" /> Start
                </button>
                <button
                  onClick={stopEntries}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.10] px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/[0.06]"
                >
                  <Square className="size-4" /> Stop entries
                </button>
                <button
                  onClick={endGiveaway}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-red-900/60 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/40"
                >
                  <XCircle className="size-4" /> End giveaway
                </button>
              </div>

              <button
                onClick={drawWinner}
                disabled={eligibleCount === 0 || revealPhase === "rolling"}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Shuffle className={`size-4 ${revealPhase === "rolling" ? "animate-spin" : ""}`} />
                {revealPhase === "rolling" ? "Rolling…" : "Roll winner"}
              </button>
              {revealPhase !== "rolling" && entrants.size > 0 && eligibleCount === 0 && (
                <p className="mt-2 text-center text-xs font-semibold text-white/30">
                  Everyone left has already won this round.
                </p>
              )}
            </section>

            {/* Current winner — rolls in suspense alongside the OBS widget instead of
                revealing the name the instant Roll winner is clicked. */}
            <section className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.022] p-5">
              <AnimatePresence mode="wait">
                {revealPhase === "revealed" && winner ? (
                  <motion.div
                    key="revealed"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex flex-col items-center gap-2 text-center"
                  >
                    <Trophy className="size-8 text-amber-400" />
                    <WinnerName
                      username={winner}
                      onClick={() => setLogWinner(winner)}
                      className="text-2xl font-bold text-white"
                    />
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
                      Current winner · click to log it
                    </p>
                  </motion.div>
                ) : revealPhase === "rolling" ? (
                  <motion.div
                    key="rolling"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center gap-2 text-center text-emerald-400"
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}>
                      <Shuffle className="size-8" />
                    </motion.div>
                    <p className="text-sm font-semibold uppercase tracking-wider">Rolling…</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center gap-2 text-center text-white/30"
                  >
                    <Crown className="size-8" />
                    <p className="text-sm font-semibold">No winner yet</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Past winners */}
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.022] p-5">
              <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
                <History className="size-3.5" /> Past winners
              </span>
              {pastWinners.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/30">No rolls yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pastWinners.map((name, index) => (
                    <WinnerName
                      key={`${name}-${index}`}
                      username={name}
                      onClick={() => setLogWinner(name)}
                      className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/60 hover:text-white"
                    />
                  ))}
                </div>
              )}
            </section>

            {/* OBS widget link */}
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.022]">
              <button
                onClick={() => setObsExpanded((current) => !current)}
                className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/40"
              >
                OBS widget
                <ChevronDown className={`size-4 transition-transform ${obsExpanded ? "rotate-180" : ""}`} />
              </button>
              {obsExpanded && (
                <div className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-4">
                  {[
                    {
                      href: "/obs/giveaway",
                      label: "Giveaway only",
                      hint: "Just this giveaway card — 300x120.",
                    },
                    {
                      href: "/obs/stream",
                      label: "Stream column",
                      hint: "Giveaway, deposits/cashouts, banners and Kick chat in one narrow column (~340px wide).",
                    },
                  ].map((widget) => (
                    <div key={widget.href} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white/80">{widget.label}</p>
                        <p className="text-xs text-white/40">{widget.hint}</p>
                      </div>
                      <a
                        href={widget.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.10] px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/[0.06]"
                      >
                        <Tv className="size-3.5" /> Open widget
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Live chat */}
          <section className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.022]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-white/80">Live chat</h2>
            </div>
            <p className="border-b border-white/[0.06] px-4 py-2 text-xs text-white/30">
              {`Type ${formatKeywordForDisplay(keyword)} in chat to enter · click an emote below to use it as the keyword`}
            </p>
            <div
              ref={feedRef}
              className="hide-scrollbar flex h-[520px] flex-col gap-1.5 overflow-y-auto p-4 font-mono text-sm lg:h-[600px]"
            >
              {messages.length === 0 ? (
                <p className="py-16 text-center text-white/30">
                  {status === "idle" ? "Connect to a channel to see live chat." : "Waiting for messages…"}
                </p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="leading-relaxed">
                    <span className={`font-bold ${message.isMod ? "text-[#53fc18]" : "text-white/80"}`}>
                      {message.username}
                    </span>
                    <span className="text-white/30">: </span>
                    <span className="text-white/60">{renderMessageContent(message.content, setKeyword)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {logWinner && (
        <RecordWinDialog
          username={logWinner}
          source="giveaway"
          sourceRef={keyword || undefined}
          onClose={() => setLogWinner(null)}
        />
      )}
    </main>
  )
}
