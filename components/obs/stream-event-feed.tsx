"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { BANNER_ASPECT_RATIO, BANNER_ROTATION_MS, OBS_BANNERS } from "@/lib/obs-banners"
import { OBS } from "@/lib/obs-theme"

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
function BanknoteArrow({
  direction,
  className,
  style,
}: {
  direction: "in" | "out"
  className?: string
  style?: React.CSSProperties
}) {
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
      style={style}
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

/**
 * The shared card shape for everything in the event column: an icon tile on the
 * left, then a label row carrying the timestamp on the right, then the value.
 */
export function EventCard({
  icon,
  label,
  labelColor,
  timestamp,
  children,
}: {
  icon: React.ReactNode
  label: string
  labelColor?: string
  timestamp?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-sm"
      style={{ backgroundColor: OBS.card, borderColor: OBS.cardBorder }}
    >
      <div
        className="mt-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: OBS.iconTile }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.10em]"
            style={{ color: labelColor ?? OBS.label }}
          >
            {label}
          </span>
          {timestamp && (
            <span className="shrink-0 text-[10px] font-medium" style={{ color: OBS.muted }}>
              {timestamp}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export function TransactionEventCard({ event }: { event: TransactionEvent }) {
  const isDeposit = event.kind === "deposit"
  const tone = isDeposit ? OBS.deposit : OBS.cashout

  return (
    <EventCard
      icon={<BanknoteArrow direction={isDeposit ? "in" : "out"} className="h-5 w-5" style={{ color: tone }} />}
      label={isDeposit ? "DEPOSIT" : "CASHOUT"}
      labelColor={tone}
      // Deliberately literal: these only ever live for TRANSACTION_EVENT_TTL_MS,
      // so a relative age would never read as anything but "now" anyway.
      timestamp="now"
    >
      <div className="text-[20px] font-extrabold leading-tight" style={{ color: OBS.value }}>
        {formatAmount(event.amount)}
      </div>
      <div className="text-[11px] leading-snug" style={{ color: OBS.muted }}>
        {isDeposit ? "has been deposited" : "has been cashed out"}
      </div>
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
      style={{ aspectRatio: BANNER_ASPECT_RATIO, backgroundColor: OBS.card, borderColor: OBS.cardBorder }}
      className="relative w-full overflow-hidden rounded-2xl border shadow-lg"
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

/** Hairline between the events and the chat. */
export function EventDivider() {
  return (
    <div className="shrink-0 px-1 py-2">
      <span className="block h-px w-full" style={{ backgroundColor: OBS.cardBorder }} />
    </div>
  )
}
