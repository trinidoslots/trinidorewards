"use client"

import { useEffect, useRef, useState } from "react"
import { Dices, Gamepad2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { OBS, OBS_RADIUS } from "@/lib/obs-theme"
import { playPing } from "@/lib/obs-ping"
import { EventCard } from "@/components/obs/stream-event-feed"
import { formatProvider } from "@/lib/providers"

/**
 * The random slot on stream: a reel that runs through slot names and slows
 * onto the result picked in /admin/random.
 *
 * Every client animates from the row alone — started_at, spin_ms and the
 * strip in `reel` — so the stream column, the standalone /random-slot source
 * and the admin's own preview all land on the same slot at the same moment,
 * and a source that reloads mid-spin picks up where the others are.
 */

export type ReelEntry = { name: string; provider: string | null; image_url: string | null }

export type RandomSpin = {
  id: string
  slot_name: string
  provider: string | null
  image_url: string | null
  reel: ReelEntry[]
  spin_ms: number
  started_at: string
}

/** How long the result stays up once the reel has stopped. */
export const RESULT_SHOWN_MS = 25_000

const TILE = 52
const VISIBLE = 3

const endsAt = (spin: RandomSpin) => Date.parse(spin.started_at) + (Number(spin.spin_ms) || 6000) + RESULT_SHOWN_MS

/** Fast start, long slow finish — the part people watch is the last second. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)

/** The latest spin while it is on screen, or null. */
export function useRandomSpin(pingVolume = 0): RandomSpin | null {
  const [spin, setSpin] = useState<RandomSpin | null>(null)
  const supabaseRef = useRef(createClient())
  const volumeRef = useRef(pingVolume)
  volumeRef.current = pingVolume

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    const backfill = async () => {
      const { data, error } = await supabase
        .from("random_slot_spins")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        // Most likely 077 has not been run; the rest of the column works without it.
        console.error("[random] Error fetching spins:", error)
        return
      }
      if (data && endsAt(data as RandomSpin) > Date.now()) setSpin(data as RandomSpin)
    }
    backfill()

    const channel = supabase
      .channel("random_slot_spins_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "random_slot_spins" }, (payload) => {
        setSpin(payload.new as RandomSpin)
        // Live spins only, not the backfill: an OBS restart should not beep.
        playPing(volumeRef.current, "event")
      })
      .subscribe()

    const sweep = setInterval(() => {
      setSpin((current) => (current && endsAt(current) <= Date.now() ? null : current))
    }, 1000)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      clearInterval(sweep)
    }
  }, [])

  return spin
}

/** Where the reel is, 0..1, from the spin's own clock. */
function useProgress(spin: RandomSpin): number {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const start = Date.parse(spin.started_at)
    const duration = Number(spin.spin_ms) || 6000
    let frame = 0
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / duration))
      setProgress(t)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [spin.id, spin.started_at, spin.spin_ms])
  return progress
}

function Thumb({ entry, size }: { entry: ReelEntry; size: number }) {
  const [failed, setFailed] = useState(false)
  const frame = { width: size, height: size, borderRadius: OBS_RADIUS.iconTile, backgroundColor: OBS.iconTile, borderColor: OBS.cardBorder }
  if (!entry.image_url || failed) {
    return (
      <div className="flex shrink-0 items-center justify-center border" style={frame}>
        <Gamepad2 className="h-4 w-4" style={{ color: OBS.muted }} />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external slot artwork
    <img src={entry.image_url} alt="" onError={() => setFailed(true)} className="shrink-0 border object-cover" style={frame} />
  )
}

/** The reel alone: three rows visible, the middle one is the pick. */
export function SlotReel({ spin }: { spin: RandomSpin }) {
  const progress = useProgress(spin)
  const reel = spin.reel?.length
    ? spin.reel
    : [{ name: spin.slot_name, provider: spin.provider, image_url: spin.image_url }]
  const last = reel.length - 1
  // One more after the pick, so the row under it is not empty when the reel stops.
  const strip = reel.length > 1 ? [...reel, reel[0]] : reel
  // Scroll from the first entry to the last; the window is centred on the
  // current row, so the strip is shifted up by one tile.
  const offset = easeOut(progress) * last * TILE - TILE
  const done = progress >= 1

  return (
    <div
      className="relative mt-1.5 overflow-hidden border"
      style={{ height: TILE * VISIBLE, borderRadius: OBS_RADIUS.iconTile, borderColor: OBS.cardBorder, backgroundColor: "rgba(0,0,0,0.25)" }}
    >
      {/* The pay line: where the pick stops. */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y transition-colors duration-500"
        style={{
          top: TILE,
          height: TILE,
          borderColor: done ? `${OBS.random}AA` : `${OBS.random}40`,
          backgroundColor: done ? `${OBS.random}1F` : "transparent",
        }}
      />
      {/* Fade the rows above and below so the middle one reads as the pick. */}
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{ background: "linear-gradient(rgba(14,14,18,0.85), transparent 35%, transparent 65%, rgba(14,14,18,0.85))" }}
      />
      <div style={{ transform: `translateY(${-offset}px)`, willChange: "transform" }}>
        {strip.map((entry, index) => (
          <div key={index} className="flex items-center gap-2.5 px-2.5" style={{ height: TILE }}>
            <Thumb entry={entry} size={TILE - 14} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight" style={{ color: OBS.value }}>
                {entry.name}
              </p>
              <p className="truncate text-[10.5px] leading-tight" style={{ color: OBS.muted }}>
                {formatProvider(entry.provider) ?? ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The card in the stream column. */
export function RandomSlotCard({ spin }: { spin: RandomSpin }) {
  const progress = useProgress(spin)
  const done = progress >= 1
  return (
    <EventCard
      icon={<Dices className={`h-5 w-5 ${done ? "" : "animate-spin"}`} style={{ color: OBS.random, animationDuration: "1.2s" }} />}
      label={done ? "RANDOM SLOT" : "SPINNING…"}
      labelColor={OBS.random}
      timestamp="now"
    >
      <SlotReel spin={spin} />
    </EventCard>
  )
}
