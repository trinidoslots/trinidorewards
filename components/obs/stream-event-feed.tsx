"use client"

import { useEffect, useRef, useState } from "react"
import { Coins, Target } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  BANNER_ASPECT_RATIO,
  BANNER_FADE_MS,
  BANNER_ROTATION_MS,
  OBS_BANNERS,
  type ObsBanner,
} from "@/lib/obs-banners"
import { OBS, OBS_RADIUS } from "@/lib/obs-theme"
import { playPing } from "@/lib/obs-ping"

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
export function useTransactionEvents(pingVolume = 0) {
  const [events, setEvents] = useState<TransactionEvent[]>([])
  const supabaseRef = useRef(createClient())

  // Read through a ref because the subscription is set up once. Without it the
  // handler would keep whatever volume the first render happened to have.
  const volumeRef = useRef(pingVolume)
  volumeRef.current = pingVolume

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
        // Here and not in backfill(): a source that reloads mid-announcement
        // picks up everything from the last thirty seconds, and pinging for
        // each of those would turn every OBS restart into a burst of beeps for
        // things that already happened.
        playPing(volumeRef.current)
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
  return `$${abs.toLocaleString("en-US")}`
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
      className="flex items-start gap-3 border px-3 py-2.5 shadow-lg"
      style={{
        backgroundColor: OBS.card,
        borderColor: OBS.cardBorder,
        borderRadius: OBS_RADIUS.card,
        // The site's signature: one coloured edge per card rather than a
        // coloured border all the way round.
        borderLeft: `2px solid ${labelColor ?? OBS.label}`,
      }}
    >
      <div
        className="mt-[2px] flex h-9 w-9 shrink-0 items-center justify-center border"
        style={{
          backgroundColor: OBS.iconTile,
          borderColor: OBS.cardBorder,
          borderRadius: OBS_RADIUS.iconTile,
        }}
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

/**
 * Fetches and decodes a banner, resolving only once it is ready to paint.
 *
 * A banner that will not load resolves too rather than rejecting: a 404 on one
 * image must not stop the rotation on the other eleven.
 */
function preloadBanner(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    // decode() settles when the bytes have arrived *and* been turned into a
    // bitmap, which is the thing that has to be true before the fade starts.
    // Old engines without it fall back to load, which is only the first half.
    if (typeof image.decode === "function") {
      image.src = src
      image.decode().then(() => resolve(), () => resolve())
      return
    }
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = src
  })
}

/**
 * Cycles the locally-configured banners; renders nothing if none are configured.
 *
 * Two <img> layers that never unmount, rather than one element keyed on the src.
 * Keying on the src meant a fresh element every 10s, mounted with an empty cache
 * and told to fade in immediately — measured on the running widget, the incoming
 * banner was undecoded at mount every single time, so it snapped into view
 * partway through its own fade. The frame timing was never the problem (median
 * 4.2ms, nothing above 33ms); the picture simply was not there yet.
 *
 * So: the next banner is fetched and decoded during the ten seconds the current
 * one is up, and the swap only happens once it can actually be painted.
 */
export function BannerRotator() {
  // Both layers start on the same banner so the first swap has something to
  // fade over. Slot 1 is always the later element, so z-index decides which
  // one is on top, not DOM order.
  const [layers, setLayers] = useState<[ObsBanner | null, ObsBanner | null]>(() => [
    OBS_BANNERS[0] ?? null,
    OBS_BANNERS[0] ?? null,
  ])
  const [front, setFront] = useState<0 | 1>(0)
  const frontRef = useRef<0 | 1>(0)

  useEffect(() => {
    if (OBS_BANNERS.length < 2) return

    let cancelled = false
    let index = 0
    let timer: ReturnType<typeof setTimeout>

    const cycle = () => {
      const next = OBS_BANNERS[(index + 1) % OBS_BANNERS.length]
      // Kick the fetch off now, not in ten seconds' time: by the time the timer
      // fires the bitmap is ready and the swap costs nothing.
      const ready = preloadBanner(next.src)

      timer = setTimeout(() => {
        void ready.then(() => {
          if (cancelled) return
          index = (index + 1) % OBS_BANNERS.length

          const back = frontRef.current === 0 ? 1 : 0
          frontRef.current = back
          setLayers((current) => (back === 0 ? [next, current[1]] : [current[0], next]))
          setFront(back)

          cycle()
        })
      }, BANNER_ROTATION_MS)
    }

    cycle()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  if (OBS_BANNERS.length === 0) return null

  return (
    // No card around it, unlike the event cards above: the artwork draws its own
    // rounded corners, its own background and its own accent rail, so a shell
    // behind it put a second border a few pixels outside the first one.
    <div style={{ aspectRatio: BANNER_ASPECT_RATIO }} className="relative w-full">
      {layers.map((banner, slot) =>
        banner ? (
          <img
            // Keyed on the slot, never on the src. These two elements are meant
            // to outlive every banner that passes through them.
            key={slot}
            src={banner.src}
            alt={slot === front ? banner.alt : ""}
            aria-hidden={slot !== front}
            // Contain, not cover: a banner is artwork with text in it, and
            // cropping an odd aspect ratio would cut the wordmark off.
            className="obs-banner-layer absolute inset-0 h-full w-full object-contain"
            style={{
              // The one underneath stays fully opaque for the whole fade. It is
              // covered by the end anyway, and holding it at 1 is what keeps the
              // two alphas summing to 1 instead of dipping in the middle.
              opacity: 1,
              zIndex: slot === front ? 1 : 0,
              // An animation rather than a transition, because the name flipping
              // between the layers is what restarts it. A transition would need
              // the opacity set back to 0 and a frame to pass first.
              animation: slot === front ? `obs-banner-fade ${BANNER_FADE_MS}ms linear both` : "none",
              willChange: slot === front ? "opacity" : "auto",
            }}
          />
        ) : null,
      )}
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

/* -------------------------------------------------------------------------- */
/*  Prediction window                                                          */
/* -------------------------------------------------------------------------- */

export type PredictionWindow = {
  hunt_id: string
  status: string
  opens_at: string | null
  closes_at: string | null
}

/**
 * Watches for an open prediction window and counts it down.
 *
 * The admin opens predictions for five minutes; the widget mirrors that so chat
 * can see how long is left without being told. Polled rather than pushed —
 * prediction_windows is not in the realtime publication, and a countdown needs
 * its own per-second tick anyway.
 */
export function usePredictionWindow() {
  const [window_, setWindow] = useState<PredictionWindow | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const fetchWindow = async () => {
      const { data, error } = await supabaseRef.current
        .from("prediction_windows")
        .select("hunt_id, status, opens_at, closes_at")
        .eq("status", "open")
        .gt("closes_at", new Date().toISOString())
        .order("closes_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error("[v0] Error fetching prediction window:", error)
        return
      }
      setWindow((data as PredictionWindow) ?? null)
    }

    fetchWindow()
    const poll = setInterval(fetchWindow, 5_000)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    if (!window_?.closes_at) {
      setSecondsLeft(0)
      return
    }
    const closesAt = new Date(window_.closes_at).getTime()
    const tick = () => setSecondsLeft(Math.max(0, Math.round((closesAt - Date.now()) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [window_?.closes_at])

  // Hide the moment it lapses, without waiting for the next poll.
  return secondsLeft > 0 ? { window: window_, secondsLeft } : null
}

export function PredictionEventCard({ secondsLeft }: { secondsLeft: number }) {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <EventCard
      icon={<Target className="h-5 w-5" style={{ color: OBS.prediction }} />}
      label="PREDICTIONS OPEN"
      labelColor={OBS.prediction}
      timestamp={`${minutes}:${String(seconds).padStart(2, "0")} left`}
    >
      <div className="text-[20px] font-extrabold leading-tight" style={{ color: OBS.value }}>
        Lock in your guess
      </div>
      <div className="text-[11px] leading-snug" style={{ color: OBS.muted }}>
        Predict the final balance on the site
      </div>
    </EventCard>
  )
}

// --- points -----------------------------------------------------------------

export type PointsEvent = {
  id: string
  points_each: number
  user_count: number
  total_points: number
  created_at: string
}

/**
 * Streams in points payouts, the same way useTransactionEvents does for
 * deposits.
 *
 * Kept as its own hook rather than folding both into a generic one: the deposit
 * announcements run live on stream, and a shared abstraction would have put
 * them at risk for the sake of thirty lines.
 */
export function usePointsEvents(pingVolume = 0) {
  const [events, setEvents] = useState<PointsEvent[]>([])
  const supabaseRef = useRef(createClient())

  const volumeRef = useRef(pingVolume)
  volumeRef.current = pingVolume

  useEffect(() => {
    const supabase = supabaseRef.current
    const isFresh = (event: PointsEvent) =>
      Date.now() - new Date(event.created_at).getTime() < TRANSACTION_EVENT_TTL_MS

    // An OBS source that reloads mid-announcement should still show the tail.
    const backfill = async () => {
      const since = new Date(Date.now() - TRANSACTION_EVENT_TTL_MS).toISOString()
      const { data, error } = await supabase
        .from("points_events")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
      if (error) {
        console.error("[points] Error fetching points events:", error)
        return
      }
      setEvents(((data ?? []) as PointsEvent[]).filter(isFresh))
    }

    backfill()

    const channel = supabase
      .channel("points_events_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "points_events" }, (payload) => {
        setEvents((current) => [payload.new as PointsEvent, ...current])
        // Live payouts only, not the backfill — see useTransactionEvents.
        playPing(volumeRef.current)
      })
      .subscribe()

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

export function PointsEventCard({ event }: { event: PointsEvent }) {
  const users = Number(event.user_count) || 0
  const each = Number(event.points_each) || 0

  return (
    <EventCard
      icon={<Coins className="h-5 w-5" style={{ color: OBS.points }} />}
      label="POINTS"
      labelColor={OBS.points}
      timestamp="now"
    >
      <div className="text-[20px] font-extrabold leading-tight" style={{ color: OBS.value }}>
        {each.toLocaleString("en-US")}
      </div>
      <div className="text-[11px] leading-snug" style={{ color: OBS.muted }}>
        {`to ${users.toLocaleString("en-US")} active ${users === 1 ? "chatter" : "chatters"}`}
      </div>
    </EventCard>
  )
}
