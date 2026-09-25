"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  BadgeCheck,
  ChevronDown,
  Crown,
  Gem,
  History,
  Play,
  Search,
  Settings,
  Shield,
  Shuffle,
  Square,
  Star,
  Trophy,
  Tv,
  XCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { restoreRound } from "@/lib/giveaway-restore"
import { RecordWinDialog, WinnerName } from "@/components/admin/record-win-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GiveawayRollDialog, type RollView } from "@/components/admin/giveaway-roll-dialog"
import { ACCENTS } from "@/components/ui/panel"

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

const KICK_GREEN = "#53FC18"

/** Kick's K, drawn so the channel button needs no image. */
function KickGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 3h6v5h3V5.5h3V3h6v6h-3v3h-3v3h3v3h3v6h-6v-2.5h-3V19H8v5H2V3z" />
    </svg>
  )
}

/**
 * The badges an entry can be limited to, and how an entrant's badges are shown.
 *
 * Read from the chat message itself (sender.identity.badges), so a filter
 * costs nothing and needs no lookup. Kick does not put "follower" in a chat
 * message, so that is not offered: it could not be checked.
 */
const ENTRY_BADGES = [
  { id: "moderator", label: "Moderator", types: ["moderator", "broadcaster"], icon: Shield, color: KICK_GREEN },
  { id: "vip", label: "VIP", types: ["vip"], icon: Crown, color: ACCENTS.amber },
  { id: "og", label: "OG", types: ["og"], icon: Gem, color: ACCENTS.blue },
  { id: "subscriber", label: "Subscriber", types: ["subscriber", "founder"], icon: Star, color: ACCENTS.purple },
  { id: "verified", label: "Verified", types: ["verified"], icon: BadgeCheck, color: ACCENTS.green },
] as const

function badgesFor(types: string[] | undefined) {
  if (!types?.length) return []
  return ENTRY_BADGES.filter((badge) => badge.types.some((type) => types.includes(type)))
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
  // The site account behind logWinner, when the roll dialog found one.
  const [logUserId, setLogUserId] = useState<string | null>(null)
  // The roll dialog: open from Roll winner until Done.
  const [rollView, setRollView] = useState<RollView | null>(null)
  // Entrants who have already won during the CURRENT round (since Start, cleared only
  // by Start or End) — kept out of the draw pool so nobody wins twice in one round.
  const [roundWinners, setRoundWinners] = useState<Set<string>>(new Set())
  const [obsExpanded, setObsExpanded] = useState(false)
  // When the current round was started (set on Start, cleared only on End — stopping
  // entries or rolling a winner does NOT clear it, since the round is still "active").
  // Drives the "Giveaway active for MM:SS" indicator.
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  // False until the round has been read back from Supabase. Gates the
  // auto-connect, which would otherwise announce a status derived from the
  // empty state this page starts in. See the restore effect below.
  const [hydrated, setHydrated] = useState(false)
  // When each entrant came in and what badges they wore. Local to this tab:
  // the OBS widget only needs the names, and a restored round simply has no
  // times for the entries made before the page was reloaded.
  const [entrantMeta, setEntrantMeta] = useState<Record<string, { at: number; badges: string[] }>>({})
  // Empty means everyone. Read through a ref by the chat handler, which is
  // created once per connection.
  const [allowedBadges, setAllowedBadges] = useState<Set<string>>(new Set())
  const allowedBadgesRef = useRef<Set<string>>(allowedBadges)
  allowedBadgesRef.current = allowedBadges
  const [search, setSearch] = useState("")
  const [rightTab, setRightTab] = useState<"entries" | "chat">("entries")
  const [copied, setCopied] = useState(false)
  const [channelOpen, setChannelOpen] = useState(false)

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
  // The status the widget was last told. A roll is timed from updated_at, so
  // anything written while it runs must neither change the status nor move
  // that clock: an entry or an avatar landing mid-roll used to write "open"
  // and a fresh updated_at, which threw the widget out of the roll or started
  // it over. See liveStatus below.
  const widgetStatusRef = useRef<"idle" | "open" | "closed" | "rolling" | "finished">("idle")

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
      /** Set by a roll, so the dialog and the widget share one start time. */
      updated_at?: string
    }) => {
      const statusChanged = patch.status !== widgetStatusRef.current
      widgetStatusRef.current = patch.status
      const row: Record<string, unknown> = { ...patch }
      // Only a change of status (or an explicit time) moves updated_at.
      if (statusChanged || patch.updated_at) row.updated_at = patch.updated_at ?? new Date().toISOString()
      else delete row.updated_at
      supabaseRef.current
        .from("giveaway_state")
        .update(row)
        .eq("id", 1)
        .then(({ error }: { error: unknown }) => {
          if (error) console.error("[v0] Failed to sync giveaway widget state:", error)
        })
    },
    [],
  )

  /** The status to keep while a roll or its winner is on screen; otherwise `fallback`. */
  const liveStatus = useCallback((fallback: "open" | "closed") => {
    const current = widgetStatusRef.current
    return current === "rolling" || current === "finished" ? current : fallback
  }, [])

  useEffect(() => {
    keywordRef.current = keyword
  }, [keyword])

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    entrantsRef.current = entrants
  }, [entrants])

  /**
   * Restores the round from Supabase on mount.
   *
   * Everything about a giveaway lived in React state, and syncWidgetState only
   * ever pushed it outwards — nothing read it back. So leaving this page and
   * returning started from nothing: no entrants, no winner, isOpen false.
   *
   * The empty entrant count was the visible half. The damaging half was that
   * the auto-connect below then pushed `status: "closed"`, derived from that
   * empty state, over a giveaway that was still running — ending it on the
   * overlay because the admin had navigated away and back.
   */
  useEffect(() => {
    let cancelled = false

    const restore = async () => {
      const { data, error } = await supabaseRef.current
        .from("giveaway_state")
        .select("*")
        .eq("id", 1)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error("[v0] Could not restore the giveaway state:", error)
        // Deliberately left un-hydrated, which keeps the auto-connect from
        // running: pushing a status worked out from empty state is exactly
        // what this effect exists to prevent. Connecting by hand still works,
        // so this says why nothing happened rather than looking merely idle.
        setStatusMessage("Could not read the current giveaway — not connecting automatically, so a running round is not ended by mistake.")
        return
      }

      if (data) {
        const round = restoreRound(data)
        const stored = String((data as { status?: unknown }).status ?? "idle")
        if (["idle", "open", "closed", "rolling", "finished"].includes(stored)) {
          widgetStatusRef.current = stored as typeof widgetStatusRef.current
        }
        const restored = new Set(round.entrants)

        if (round.keyword) setKeyword(round.keyword)
        if (round.rollDuration) setRollDuration(round.rollDuration)

        setEntrants(restored)
        setAvatars(round.avatars)
        setIsOpen(round.isOpen)
        setStartedAt(round.startedAt)
        setWinner(round.winner)
        setRevealPhase(round.revealPhase)
        setRoundWinners(new Set(round.roundWinners))

        // Written straight through as well as via setState: connect() reads the
        // refs, and the effects that keep them in step only run after the next
        // render — which is after the auto-connect below would have fired.
        entrantsRef.current = restored
        isOpenRef.current = round.isOpen
      }

      setHydrated(true)
    }

    void restore()

    return () => {
      cancelled = true
    }
  }, [])

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
            syncWidgetState({ status: liveStatus(isOpenRef.current ? "open" : "closed"), entrant_avatars: next })
            return next
          })
        })
        .catch(() => {
          setAvatars((latest) => ({ ...latest, [key]: null }))
        })

      avatarPromisesRef.current.set(key, promise)
      return promise
    },
    [syncWidgetState, liveStatus],
  )

  // The ONLY effect chat has on state: counting entries while the giveaway is open.
  // No chat message, from anyone, can start, stop, or draw the giveaway.
  // Duplicate entries are rejected here: the Set is keyed by lowercased username,
  // so a user typing the keyword multiple times only ever counts once per giveaway.
  const handleChatEntry = useCallback(
    (username: string, content: string, badges: Badge[] = []) => {
      const trimmedContent = content.trim().toLowerCase()
      const trimmedKeyword = keywordRef.current.trim().toLowerCase()
      const open = isOpenRef.current
      const types = badges.map((badge) => badge.type)
      // "Who can enter": with badges picked, the chatter has to wear one.
      const allowed = allowedBadgesRef.current
      const eligible =
        allowed.size === 0 ||
        ENTRY_BADGES.some((badge) => allowed.has(badge.id) && badge.types.some((type) => types.includes(type)))
      const counted = open && eligible && trimmedContent === trimmedKeyword && trimmedKeyword.length > 0

      console.log("[v0] chat message:", content, "| counted as entry:", counted)

      if (counted) {
        setEntrants((current) => {
          if (current.has(username.toLowerCase())) return current // already entered — ignore duplicate
          const next = new Set(current)
          next.add(username.toLowerCase())
          setEntrantMeta((meta) => ({ ...meta, [username.toLowerCase()]: { at: Date.now(), badges: types } }))
          // Fetch the entrant's avatar now, pre-roll, instead of at draw time.
          fetchAvatarFor(username)
          // Keep the OBS widget's entrant count live as people enter, not just at start/draw.
          syncWidgetState({ status: liveStatus("open"), entrants: Array.from(next) })
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
              syncWidgetState({ status: liveStatus(isOpenRef.current ? "open" : "closed"), channel_slug: trimmedSlug })
              return
            }

            if (frame.event === "App\\Events\\ChatMessageEvent") {
              const payload: KickChatPayload = JSON.parse(frame.data)
              const username = payload.sender?.username ?? "unknown"
              const content = payload.content ?? ""
              const isMod = isModOrBroadcaster(payload.sender?.identity?.badges)
              appendMessage(username, content, isMod)
              handleChatEntry(username, content, payload.sender?.identity?.badges ?? [])
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

  // Auto-connect to the default Kick channel once the round has been restored.
  // Waiting on `hydrated` matters: connect() syncs the widget status from
  // isOpenRef, so running it first would push "closed" over a live giveaway.
  useEffect(() => {
    if (!hydrated || autoConnectedRef.current) return
    autoConnectedRef.current = true
    connect(DEFAULT_SLUG)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, after hydration
  }, [hydrated])

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
    setEntrantMeta({})
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
    setEntrantMeta({})
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

  /** Takes one name out of the round, e.g. a winner who cannot take the prize. */
  const removeEntrant = useCallback(
    (name: string) => {
      const key = name.toLowerCase()
      setEntrants((current) => {
        if (!current.has(key)) return current
        const next = new Set(current)
        next.delete(key)
        entrantsRef.current = next
        syncWidgetState({ status: liveStatus(isOpenRef.current ? "open" : "closed"), entrants: Array.from(next) })
        return next
      })
      setEntrantMeta((meta) => {
        const { [key]: _gone, ...rest } = meta
        return rest
      })
    },
    [syncWidgetState, liveStatus],
  )

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
    // One start time for both: written to the widget as updated_at, and the
    // dialog's reel starts from it, so the two land together.
    const rolledAt = Date.now()
    syncWidgetState({
      status: "rolling",
      keyword,
      entrants: eligible,
      winner: pickedWinner,
      roll_duration_seconds: rollDuration,
      updated_at: new Date(rolledAt).toISOString(),
    })
    setRollView({
      pool: eligible,
      winner: pickedWinner,
      startAt: rolledAt + ROLL_START_DELAY_SECONDS * 1000,
      durationMs: rollDuration * 1000,
      total: pool.length,
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
  const needle = search.trim().toLowerCase()
  const shownEntrants = needle ? entrantList.filter((name) => name.includes(needle)) : entrantList
  const displayKeyword = formatKeywordForDisplay(keyword)

  const exportRows = () =>
    entrantList.map((name) => {
      const meta = entrantMeta[name]
      return { name, at: meta ? new Date(meta.at).toISOString() : "", badges: (meta?.badges ?? []).join(" ") }
    })

  const download = (filename: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
  const copyNames = async () => {
    try {
      await navigator.clipboard.writeText(entrantList.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard refused (an unfocused tab); Text still works.
    }
  }
  const exportText = () => download(`giveaway-entries-${stamp}.txt`, entrantList.join("\n"), "text/plain")
  const exportCsv = () => {
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
    const lines = ["username,entered_at,badges", ...exportRows().map((row) => [row.name, row.at, row.badges].map(quote).join(","))]
    download(`giveaway-entries-${stamp}.csv`, lines.join("\n"), "text/csv")
  }

  const toggleBadge = (id: string) => {
    setAllowedBadges((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main className="min-h-screen text-white/90">
      <div className="mx-auto max-w-[1100px]">
        {/* Title row */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Keyword Giveaways</h1>

          <div className="flex items-center gap-2">
            {/* The channel being read. Connected, it is a name; click to change it. */}
            <Popover open={channelOpen} onOpenChange={setChannelOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] font-semibold text-white transition hover:border-white/[0.16]"
                >
                  {channelAvatar ? (
                    <img src={channelAvatar} alt="" className="size-5 rounded-full object-cover" />
                  ) : (
                    <KickGlyph className="size-4" style={{ color: KICK_GREEN }} />
                  )}
                  {status === "connected" ? slug : "Kick"}
                  <span className={`size-2 rounded-full ${statusColor}`} />
                  <ChevronDown className="size-3.5 text-white/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[280px] border-white/[0.10] bg-[#0E0E11] p-3 text-white">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white/35">Kick channel</p>
                <div className="flex items-center gap-1.5">
                  <input
                    value={slugInput}
                    onChange={(event) => setSlugInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        connect()
                        setChannelOpen(false)
                      }
                    }}
                    placeholder="channel-slug"
                    className="h-9 min-w-0 flex-1 rounded-md border border-white/[0.10] bg-black/30 px-2.5 text-[13px] text-white outline-none focus:border-white/25"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      connect()
                      setChannelOpen(false)
                    }}
                    className="h-9 rounded-md px-3 text-[12px] font-bold text-[#0B0B0D]"
                    style={{ backgroundColor: KICK_GREEN }}
                  >
                    Connect
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="capitalize text-white/40">{status}</span>
                  {status !== "idle" && (
                    <button type="button" onClick={disconnect} className="text-white/40 underline-offset-2 hover:text-white hover:underline">
                      Disconnect
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Round settings: the roll length, and the OBS sources. */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Giveaway settings"
                  className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 transition hover:border-white/[0.16] hover:text-white"
                >
                  <Settings className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px] border-white/[0.10] bg-[#0E0E11] p-4 text-white">
                <label className="flex items-center justify-between gap-3 text-[13px] text-white/70">
                  <span>Roll duration</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="range"
                      min={2}
                      max={20}
                      value={rollDuration}
                      onChange={(event) => setRollDuration(Number(event.target.value))}
                      className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-white/[0.08]"
                      style={{ accentColor: ACCENTS.purple }}
                    />
                    <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-white">{rollDuration}s</span>
                  </span>
                </label>
                <div className="mt-4 space-y-2.5 border-t border-white/[0.08] pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/35">OBS sources</p>
                  {[
                    { href: "/obs/giveaway", label: "Giveaway only", hint: "The card on its own, 300x120." },
                    { href: "/obs/stream", label: "Stream column", hint: "Giveaway, events and chat, ~340px wide." },
                  ].map((widget) => (
                    <a
                      key={widget.href}
                      href={widget.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition hover:bg-white/[0.04]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] text-white/80">{widget.label}</span>
                        <span className="block text-[11px] text-white/35">{widget.hint}</span>
                      </span>
                      <Tv className="size-4 shrink-0 text-white/35" />
                    </a>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* The keyword, and the round's two buttons */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.022] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="keyword"
              aria-label="Entry keyword"
              className="min-w-0 flex-1 bg-transparent text-[28px] font-bold tracking-tight text-white outline-none placeholder:text-white/20"
            />
            <button
              type="button"
              onClick={drawWinner}
              disabled={eligibleCount === 0 || revealPhase === "rolling"}
              className="flex h-11 items-center gap-2 rounded-lg px-5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.purple }}
            >
              <Shuffle className={`size-4 ${revealPhase === "rolling" ? "animate-spin" : ""}`} />
              {revealPhase === "rolling" ? "Rolling…" : "Roll winner"}
            </button>
            {isOpen ? (
              <button
                type="button"
                onClick={stopEntries}
                className="flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white"
              >
                <Square className="size-4" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={startGiveaway}
                className="flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold text-[#0B0B0D] transition hover:brightness-110"
                style={{ backgroundColor: KICK_GREEN }}
              >
                <Play className="size-4" /> Start
              </button>
            )}
          </div>

          {/* Only the button's label says "entries are closed"; this line says what is happening. */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[12px]">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-white/45">
              <span className={`size-1.5 rounded-full ${status === "connected" ? "bg-[#53fc18]" : statusColor}`} />
              {status === "connected" ? (
                <>
                  {isOpen ? "Listening in" : "Connected to"} <span className="font-semibold text-white/80">{slug}</span>&apos;s chat
                </>
              ) : (
                <span className="capitalize">{status === "idle" ? "Not connected" : status}</span>
              )}
              <span className="text-white/20">·</span>
              <span className="font-semibold text-white/80">{entrants.size.toLocaleString("en-US")}</span> entrants
              {startedAt !== null && (
                <>
                  <span className="text-white/20">·</span>
                  <span style={{ color: isOpen ? KICK_GREEN : undefined }}>
                    {isOpen ? "open" : "entries stopped"} for {formatElapsed(elapsedSeconds)}
                  </span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                if (entrants.size === 0 || window.confirm("End the giveaway and clear every entry?")) endGiveaway()
              }}
              className="flex items-center gap-1.5 text-white/40 transition hover:text-white"
            >
              <XCircle className="size-3.5" /> End &amp; clear entries
            </button>
          </div>
        </section>

        {statusMessage && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[12px]"
            style={{ borderColor: `${ACCENTS.amber}55`, backgroundColor: `${ACCENTS.amber}12`, color: ACCENTS.amber }}
          >
            <AlertCircle className="size-4 shrink-0" />
            {statusMessage}
          </div>
        )}
        {isOpen && !displayKeyword && (
          <div
            className="mt-3 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[12px]"
            style={{ borderColor: `${ACCENTS.amber}55`, backgroundColor: `${ACCENTS.amber}12`, color: ACCENTS.amber }}
          >
            <AlertCircle className="size-4 shrink-0" />
            There is no keyword, so nobody can enter. Type one above.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Left: who can enter, and the round's winners */}
          <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-white/[0.08] bg-white/[0.022] p-4">
              <p className="mb-3 text-[13px] text-white/45">Who can enter</p>
              <p className="mb-2 text-[13px] font-semibold text-white/85">Badges</p>
              <div className="flex flex-wrap gap-1.5">
                {ENTRY_BADGES.map((badge) => {
                  const on = allowedBadges.has(badge.id)
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => toggleBadge(badge.id)}
                      aria-pressed={on}
                      className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition"
                      style={
                        on
                          ? { borderColor: `${badge.color}66`, backgroundColor: `${badge.color}1a`, color: "#fff" }
                          : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }
                      }
                    >
                      <badge.icon className="size-3.5" style={{ color: badge.color }} />
                      {badge.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-white/30">
                {allowedBadges.size === 0
                  ? "None picked: anyone who types the keyword gets in."
                  : "Only chatters wearing one of these badges get in. Applies to new entries."}
              </p>
            </section>

            {/* Rolls in suspense with the OBS widget instead of spoiling the name. */}
            <section className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.022] p-4">
              <AnimatePresence mode="wait">
                {revealPhase === "revealed" && winner ? (
                  <motion.div
                    key="revealed"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex flex-col items-center gap-1.5 text-center"
                  >
                    <Trophy className="size-7" style={{ color: ACCENTS.amber }} />
                    <WinnerName username={winner} onClick={() => setLogWinner(winner)} className="text-xl font-bold text-white" />
                    <p className="text-[11px] uppercase tracking-wider text-white/30">Winner · click to log it</p>
                  </motion.div>
                ) : revealPhase === "rolling" ? (
                  <motion.div
                    key="rolling"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2 text-center"
                    style={{ color: ACCENTS.purple }}
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}>
                      <Shuffle className="size-7" />
                    </motion.div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider">Rolling…</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2 text-center text-white/30"
                  >
                    <Crown className="size-7" />
                    <p className="text-[13px]">No winner yet</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-white/[0.022] p-4">
              <p className="mb-2.5 flex items-center gap-2 text-[13px] text-white/45">
                <History className="size-3.5" /> Past winners
              </p>
              {pastWinners.length === 0 ? (
                <p className="text-[12px] text-white/30">No rolls yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {pastWinners.map((name, index) => (
                    <WinnerName
                      key={`${name}-${index}`}
                      username={name}
                      onClick={() => setLogWinner(name)}
                      className="rounded-md bg-white/[0.05] px-2.5 py-1 text-[12px] text-white/65 hover:text-white"
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: the entries, or the live chat the keyword is read from */}
          <section className="flex min-h-[520px] flex-col rounded-xl border border-white/[0.08] bg-white/[0.022]">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-1">
                {(["entries", "chat"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRightTab(tab)}
                    className="rounded-md px-2.5 py-1 text-[13px] transition"
                    style={rightTab === tab ? { backgroundColor: "rgba(255,255,255,0.07)", color: "#fff" } : { color: "rgba(255,255,255,0.45)" }}
                  >
                    {tab === "entries" ? `Entries${entrants.size ? ` · ${entrants.size}` : ""}` : "Live chat"}
                  </button>
                ))}
              </div>
              {rightTab === "entries" && (
                <div className="flex items-center gap-3 text-[12px] text-white/45">
                  <button type="button" onClick={() => void copyNames()} disabled={!entrants.size} className="transition hover:text-white disabled:opacity-40">
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button type="button" onClick={exportText} disabled={!entrants.size} className="transition hover:text-white disabled:opacity-40">
                    Text
                  </button>
                  <button type="button" onClick={exportCsv} disabled={!entrants.size} className="transition hover:text-white disabled:opacity-40">
                    CSV
                  </button>
                </div>
              )}
            </div>

            {rightTab === "entries" ? (
              <>
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
                  <Search className="size-3.5 text-white/30" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a name"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
                  />
                </div>
                <div className="hide-scrollbar flex-1 overflow-y-auto px-2 py-1.5 lg:max-h-[560px]">
                  {entrantList.length === 0 ? (
                    <p className="py-16 text-center text-[13px] text-white/30">
                      {isOpen ? `Type ${displayKeyword || "the keyword"} in chat to enter.` : "No entries. Start a round to open entries."}
                    </p>
                  ) : shownEntrants.length === 0 ? (
                    <p className="py-16 text-center text-[13px] text-white/30">Nobody by that name.</p>
                  ) : (
                    shownEntrants.map((entrant) => {
                      const meta = entrantMeta[entrant]
                      // The pick is known the moment the roll starts; saying so here would spoil it.
                      const won = roundWinners.has(entrant) && !(revealPhase === "rolling" && winner === entrant)
                      const current = winner === entrant && revealPhase === "revealed"
                      return (
                        <div
                          key={entrant}
                          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px]"
                          style={current ? { backgroundColor: `${ACCENTS.amber}14` } : undefined}
                        >
                          <span className={`truncate font-medium ${won && !current ? "text-white/35" : "text-white/85"}`}>{entrant}</span>
                          {badgesFor(meta?.badges).map((badge) => (
                            <badge.icon key={badge.id} className="size-3.5 shrink-0" style={{ color: badge.color }} aria-label={badge.label} />
                          ))}
                          {won && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: ACCENTS.amber }}>
                              Won
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-white/30">
                            {meta ? new Date(meta.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="border-b border-white/[0.06] px-4 py-2 text-[11px] text-white/30">
                  Click an emote to make it the keyword.
                </p>
                <div ref={feedRef} className="hide-scrollbar flex h-[520px] flex-col gap-1.5 overflow-y-auto p-4 font-mono text-[13px]">
                  {messages.length === 0 ? (
                    <p className="py-16 text-center text-white/30">
                      {status === "idle" ? "Connect to a channel to see live chat." : "Waiting for messages…"}
                    </p>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="leading-relaxed">
                        <span className={`font-bold ${message.isMod ? "text-[#53fc18]" : "text-white/80"}`}>{message.username}</span>
                        <span className="text-white/30">: </span>
                        <span className="text-white/60">{renderMessageContent(message.content, setKeyword)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {rollView && (
        <GiveawayRollDialog
          view={rollView}
          avatars={avatars}
          onLog={(name, userId) => {
            setLogUserId(userId)
            setLogWinner(name)
          }}
          onRemove={removeEntrant}
          onDone={() => setRollView(null)}
        />
      )}

      {logWinner && (
        <RecordWinDialog
          username={logWinner}
          userId={logUserId ?? undefined}
          source="giveaway"
          sourceRef={keyword || undefined}
          onClose={() => {
            setLogWinner(null)
            setLogUserId(null)
          }}
        />
      )}
    </main>
  )
}
