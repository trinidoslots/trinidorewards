"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { BANNER_ASPECT_RATIO, BANNER_ROTATION_MS, OBS_BANNERS } from "@/lib/obs-banners"

export type TransactionKind = "deposit" | "cashout"

export type TransactionEvent = {
  id: string
  kind: TransactionKind
  amount: number
  created_at: string
}

/**
 * A deposit/cashout announcement is a "look what just happened" beat, not a log —
 * it reads "now" for its whole life and then leaves.
 */
export const TRANSACTION_EVENT_TTL_MS = 30_000

/**
 * Streams in deposit/cashout events and drops each one once it ages out, so the
 * caller only ever sees what should currently be on screen.
 */
export function useTransactionEvents() {
  const [events, setEvents] = useState<TransactionEvent[]>([])
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    const isFresh = (event: TransactionEvent) =>
      Date.now() - new Date(event.created_at).getTime() < TRANSACTION_EVENT_TTL_MS

    // On mount, pick up anything that fired in the last few seconds — an OBS
    // source that reloads mid-announcement should still show the tail of it.
    const backfill = async () => {
      const since = new Date(Date.now() - TRANSACTION_EVENT_TTL_MS).toISOString()
      const { data, error } = await supabase
        .from("transaction_events")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
      if (error) {
        console.error("[v0] Error fetching transaction events:", error)
        return
      }
      setEvents(((data ?? []) as TransactionEvent[]).filter(isFresh))
    }

    backfill()

    const channel = supabase
      .channel("transaction_events_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transaction_events" }, (payload) => {
        setEvents((current) => [payload.new as TransactionEvent, ...current])
      })
      .subscribe()

    // Expiry is time-based, so it needs its own tick — no row changes to react to.
    const sweep = setInterval(() => {
      setEvents((current) => {
        const next = current.filter(isFresh)
        return next.length === current.length ? current : next
      })
    }, 1_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(sweep)
    }
  }, [])

  return events
}

function formatAmount(amount: number) {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`
  if (abs >= 10_000) return `$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`
  return `$${abs.toLocaleString()}`
}

// lucide-react 0.454 predates the banknote-arrow icons, so they are drawn here
// rather than pulling the whole library forward for two glyphs.
function BanknoteArrow({ direction, className }: { direction: "in" | "out"; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5" />
      <path d="M18 12h.01" />
      <path d="M6 12h.01" />
      <circle cx="12" cy="12" r="2" />
      {direction === "in" ? (
        <>
          <path d="m16 19 3 3 3-3" />
          <path d="M19 16v6" />
        </>
      ) : (
        <>
          <path d="m22 19-3-3-3 3" />
          <path d="M19 22v-6" />
        </>
      )}
    </svg>
  )
}

export function EventCard({
  icon,
  title,
  titleColor,
  timestamp,
  children,
}: {
  icon: React.ReactNode
  title: string
  titleColor: string
  timestamp?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-gradient-to-b from-[#1A1F2B]/95 to-[#0B0E13]/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: titleColor }}>
            {title}
          </span>
          {timestamp && <span className="shrink-0 text-[9px] font-medium text-gray-500">{timestamp}</span>}
        </div>
        {children && <div className="mt-0.5 text-[12px] leading-snug text-gray-200">{children}</div>}
      </div>
    </div>
  )
}

export function TransactionEventCard({ event }: { event: TransactionEvent }) {
  const isDeposit = event.kind === "deposit"

  return (
    <EventCard
      icon={
        isDeposit ? (
          <BanknoteArrow direction="in" className="h-4 w-4 text-[#fb7185]" />
        ) : (
          <BanknoteArrow direction="out" className="h-4 w-4 text-[#34D399]" />
        )
      }
      title={isDeposit ? "DEPOSIT" : "CASHOUT"}
      titleColor={isDeposit ? "#fb7185" : "#34D399"}
      // Deliberately literal: these only ever live for TRANSACTION_EVENT_TTL_MS,
      // so a relative age would never read as anything but "now" anyway.
      timestamp="now"
    >
      <span className="font-semibold text-white">{formatAmount(event.amount)}</span>{" "}
      {isDeposit ? "has been deposited" : "has been cashed out"}
    </EventCard>
  )
}

/** Cycles the locally-configured banners; renders nothing if none are configured. */
export function BannerRotator() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (OBS_BANNERS.length < 2) return
    const interval = setInterval(() => setIndex((current) => (current + 1) % OBS_BANNERS.length), BANNER_ROTATION_MS)
    return () => clearInterval(interval)
  }, [])

  if (OBS_BANNERS.length === 0) return null
  const banner = OBS_BANNERS[index % OBS_BANNERS.length]

  return (
    <div
      style={{ aspectRatio: BANNER_ASPECT_RATIO }}
      className="relative w-full overflow-hidden rounded-xl border-2 border-[#4D84FF]/55 bg-[#0B0E13]/95 shadow-lg"
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={banner.src}
          src={banner.src}
          alt={banner.alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          // Contain, not cover: a banner is artwork with text in it, and cropping
          // an odd aspect ratio would cut the wordmark off.
          className="absolute inset-0 h-full w-full object-contain"
        />
      </AnimatePresence>
    </div>
  )
}

export function EventDivider() {
  return (
    <div className="flex shrink-0 items-center gap-2 px-1 py-1.5">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
      <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-gray-600">Chat</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
    </div>
  )
}
