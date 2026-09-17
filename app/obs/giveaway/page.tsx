"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Gift, Trophy, Users, User } from "lucide-react"

type GiveawayStatus = "idle" | "open" | "closed" | "rolling" | "finished"

type GiveawayState = {
  status: GiveawayStatus
  keyword: string | null
  entrants: string[]
  entrant_avatars: Record<string, string | null>
  winner: string | null
  roll_duration_seconds: number
  updated_at: string
}

const CELL_WIDTH = 44
const STRIP_LENGTH = 60
const WINNER_INDEX = 48

// The wheel holds still (showing the strip, not scrolling) for this long after the admin
// clicks Roll winner before it actually starts scrolling — gives a visual "halt, then go"
// feel and doubles as buffer time for avatars to finish loading. Must match
// ROLL_START_DELAY_SECONDS in app/admin/giveaway/page.tsx so the admin's "finished" timeout
// fires exactly when this animation settles on the winner.
const ROLL_START_DELAY_MS = 2000

// Fixed footprint so OBS never has to reposition the browser source as the
// giveaway moves through idle / open / closed / rolling / finished.
const WIDGET_WIDTH = 300
const WIDGET_HEIGHT = 120

// Kick emotes arrive in chat as raw codes like "[emote:553704:trainwreckstvNodders]" —
// show just the emote name here so the keyword box doesn't have to fit the full code.
const EMOTE_CODE_SINGLE = /^\[(?:emote|emoji):\d+:([^\]]+)\]$/

function formatKeywordForDisplay(keyword: string | null | undefined) {
  if (!keyword) return ""
  const trimmed = keyword.trim()
  const match = trimmed.match(EMOTE_CODE_SINGLE)
  return match ? match[1] : trimmed
}

function keywordTextSizeClass(text: string) {
  if (text.length > 20) return "text-sm"
  if (text.length > 14) return "text-base"
  if (text.length > 9) return "text-lg"
  return "text-xl"
}

export default function GiveawayObsWidget() {
  const [state, setState] = useState<GiveawayState | null>(null)
  const [strip, setStrip] = useState<string[]>([])
  const [translateX, setTranslateX] = useState(0)
  const [rollComplete, setRollComplete] = useState(false)
  const supabaseRef = useRef(createClient())
  const rollKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = supabaseRef.current

    const fetchState = async () => {
      const { data, error } = await supabase.from("giveaway_state").select("*").eq("id", 1).maybeSingle()
      if (error) {
        console.error("[v0] Error fetching giveaway state:", error)
        return
      }
      if (data) setState(data as GiveawayState)
    }

    fetchState()

    const channel = supabase
      .channel("giveaway_state_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "giveaway_state" }, (payload) => {
        setState(payload.new as GiveawayState)
      })
      .subscribe()

    // Realtime can occasionally miss a beat (e.g. right after a subscribe), so
    // keep a light poller as a safety net rather than relying on push alone.
    const pollInterval = setInterval(fetchState, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [])

  // Avatars are fetched pre-roll by the admin panel as entrants join (and cached on
  // giveaway_state.entrant_avatars), so the widget never fetches them itself — doing
  // it here at roll time was flaky mid-animation and caused avatars to pop in late.
  const avatars = state?.entrant_avatars ?? {}

  // Build the scrolling strip once per roll (keyed by winner + updated_at so a
  // parent re-render never regenerates it mid-animation) and kick off the
  // translateX animation, adjusting for any time already elapsed so a widget
  // that (re)loads mid-roll still lands on the winner at the right moment.
  useEffect(() => {
    if (!state || state.status !== "rolling" || !state.winner) {
      if (!state || state.status !== "finished") setRollComplete(false)
      return
    }

    const rollKey = `${state.winner}-${state.updated_at}`
    if (rollKeyRef.current === rollKey) return
    rollKeyRef.current = rollKey
    setRollComplete(false)

    const pool = state.entrants.length > 0 ? state.entrants : [state.winner]
    const built: string[] = []
    for (let i = 0; i < STRIP_LENGTH; i++) {
      built.push(i === WINNER_INDEX ? state.winner : pool[Math.floor(Math.random() * pool.length)])
    }
    setStrip(built)
    setTranslateX(0)

    const elapsedMs = Date.now() - new Date(state.updated_at).getTime()
    const totalScrollMs = state.roll_duration_seconds * 1000
    const finalOffset = -(WINNER_INDEX * CELL_WIDTH - CELL_WIDTH / 2)

    // Phase 1: the wheel holds still on the stationary strip for ROLL_START_DELAY_MS —
    // it's already visible (status "rolling"), it just hasn't started moving yet.
    if (elapsedMs < ROLL_START_DELAY_MS) {
      const remainingHaltMs = ROLL_START_DELAY_MS - elapsedMs
      const startTimer = setTimeout(() => {
        requestAnimationFrame(() => setTranslateX(finalOffset))
      }, remainingHaltMs)
      const completeTimer = setTimeout(() => setRollComplete(true), remainingHaltMs + totalScrollMs)
      return () => {
        clearTimeout(startTimer)
        clearTimeout(completeTimer)
      }
    }

    // Phase 2: already past the halt — resume (or catch up on) the scroll itself.
    const elapsedScrollMs = elapsedMs - ROLL_START_DELAY_MS
    const remainingScrollMs = Math.max(totalScrollMs - elapsedScrollMs, 0)

    if (remainingScrollMs <= 0) {
      setTranslateX(finalOffset)
      setRollComplete(true)
      return
    }

    const raf = requestAnimationFrame(() => setTranslateX(finalOffset))
    const timer = setTimeout(() => setRollComplete(true), remainingScrollMs)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [state?.status, state?.winner, state?.updated_at, state?.entrants, state?.roll_duration_seconds])

  const status = state?.status ?? "idle"

  return (
    <div className="min-h-screen bg-transparent p-4">
      <div
        style={{ width: WIDGET_WIDTH, height: WIDGET_HEIGHT }}
        className="flex flex-col overflow-hidden rounded-xl border border-[#4D84FF]/30 bg-gradient-to-b from-[#1A1F2B]/95 to-[#0B0E13]/95 shadow-2xl backdrop-blur-sm"
      >
        {/* Header — fixed, never grows or shrinks */}
        <div className="flex flex-shrink-0 items-center justify-between px-2.5 pt-2 pb-1">
          <div className="flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-[#7FB3FF]" />
            <h1 className="text-sm font-bold text-white">Giveaway</h1>
          </div>
          {/* Last winner badge — shown while the round is still active (open or
              entries stopped) so the crowned winner stays visible until the
              giveaway is actually ended/cleared, not just when entrants change. */}
          {(status === "open" || status === "closed") && state?.winner && (
            <div className="flex max-w-[140px] items-center gap-1 rounded-full border border-[#B18CFF]/30 bg-[#B18CFF]/10 py-0.5 pl-1.5 pr-1.5">
              <span className="shrink-0 text-[7px] font-semibold uppercase tracking-wide text-[#B18CFF]">
                Last winner:
              </span>
              <AvatarImage username={state.winner} avatar={avatars[state.winner] ?? null} size={14} />
              <span className="truncate text-[8px] font-bold text-gray-200">{state.winner}</span>
            </div>
          )}
        </div>

        {/* Content — fills the remaining fixed area; only what's inside changes.
            AnimatePresence cross-fades between statuses (open/closed <-> rolling <-> finished)
            instead of the old hard cut, mode="wait" keeps only one status mounted at a time
            so the fixed-height container never doubles up mid-transition. */}
        <div className="flex flex-1 flex-col overflow-hidden px-2.5 pb-1.5">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex flex-1 items-center justify-center"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  No active giveaway
                </span>
              </motion.div>
            )}

            {status === "open" && (
              <motion.div
                key="open"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex flex-1 flex-col justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-[#7FB3FF]">
                    Active Keyword
                  </span>
                  <div className="flex items-center justify-center rounded-lg border border-[#4D84FF]/30 bg-gradient-to-r from-[#4D84FF]/15 to-transparent px-2.5 py-1.5">
                    <span
                      className={`text-balance break-words text-center font-bold leading-tight text-white ${keywordTextSizeClass(
                        formatKeywordForDisplay(state?.keyword),
                      )}`}
                    >
                      {formatKeywordForDisplay(state?.keyword)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Users className="h-2.5 w-2.5 text-[#7FB3FF]" /> Entries
                  </span>
                  <span className="font-semibold text-white">{state?.entrants.length ?? 0}</span>
                </div>
              </motion.div>
            )}

            {status === "closed" && (
              <motion.div
                key="closed"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex flex-1 flex-col justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-[#7FB3FF]">
                    Active Keyword
                  </span>
                  <div className="flex flex-col items-center justify-center gap-0 rounded-lg border border-[#4D84FF]/30 bg-gradient-to-r from-[#4D84FF]/15 to-transparent px-2.5 py-1.5 text-center">
                    <span className="text-xs font-bold text-white">Entries stopped</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                      Awaiting roll
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Users className="h-2.5 w-2.5 text-[#7FB3FF]" /> Entries
                  </span>
                  <span className="font-semibold text-white">{state?.entrants.length ?? 0}</span>
                </div>
              </motion.div>
            )}

            {status === "rolling" && (
              <motion.div
                key="rolling"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex w-full flex-col gap-1"
              >
                <div className="text-center text-[9px] font-semibold uppercase tracking-wide text-[#7FB3FF]">
                  {rollComplete ? "We have a winner!" : "Rolling"}
                </div>
                <div className="relative mx-auto h-10 w-full overflow-hidden rounded-lg border border-[#4D84FF]/30 bg-[#0B0E13]">
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[2px] -translate-x-1/2 bg-[#4D84FF] shadow-[0_0_8px_2px_rgba(77,132,255,0.6)]" />
                  <motion.div
                    className="absolute inset-y-0 left-1/2 flex items-center gap-1 py-1"
                    animate={{ x: translateX }}
                    transition={{ duration: state?.roll_duration_seconds ?? 6, ease: [0.12, 0, 0.15, 1] }}
                  >
                    {strip.map((username, index) => (
                      <AvatarChip
                        key={`${username}-${index}`}
                        username={username}
                        avatar={avatars[username]}
                        highlight={rollComplete && index === WINNER_INDEX}
                      />
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {status === "finished" && state?.winner && (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex w-full flex-col items-center gap-1"
              >
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-[#7FB3FF]">
                  <Trophy className="h-3 w-3 text-[#B18CFF]" /> Winner
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[#4D84FF]/30 bg-gradient-to-r from-[#4D84FF]/15 to-transparent px-2.5 py-1.5">
                  <AvatarImage username={state.winner} avatar={avatars[state.winner] ?? null} size={22} />
                  <span className="text-balance text-sm font-bold text-white">{state.winner}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function AvatarChip({
  username,
  avatar,
  highlight,
}: {
  username: string
  avatar: string | null | undefined
  highlight: boolean
}) {
  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-0 rounded-lg px-0.5 py-0.5 transition-colors ${
        highlight ? "bg-[#4D84FF]/20 ring-2 ring-[#4D84FF]" : ""
      }`}
      style={{ width: CELL_WIDTH - 4 }}
    >
      <AvatarImage username={username} avatar={avatar ?? null} size={18} />
      <span className="max-w-full truncate text-[7px] font-semibold text-gray-300">{username}</span>
    </div>
  )
}

function AvatarImage({ username, avatar, size }: { username: string; avatar: string | null; size: number }) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-full border border-[#4D84FF]/30 bg-[#0B0E13]"
      style={{ width: size, height: size }}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable Kick avatar host
        <img
          src={avatar || "/placeholder.svg"}
          alt={username}
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <User className="absolute inset-0 m-auto h-1/2 w-1/2 text-[#4D84FF]/50" />
      )}
    </span>
  )
}
