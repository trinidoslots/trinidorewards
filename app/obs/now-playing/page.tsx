"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { BADGE_GRADIENT, BADGE_TEXT, formatMoney, isPlaying, type NowPlayingRow } from "@/lib/now-playing"

/**
 * The slot currently being played, as the casino's own info bar.
 *
 * Badge, title, provider, potential, best win — and nothing else. Best X and
 * Avg X are in the reference but deliberately left out.
 *
 * Nothing here was matched by eye. The reference screenshot was measured at
 * native 1920×1080, where the bar is 44px tall, and every size below is that
 * measurement over 44:
 *
 *   left padding   27px   badge  71×22 at x=27
 *   text           ~16px throughout — the title is NOT larger than the
 *                  provider in the reference, only bolder
 *   gaps           7px inside a pair, 11px label→figure, ~40px between groups
 *
 * The typeface was solved for rather than guessed: six candidates, each asked
 * what size reproduces the measured pixel width of six known strings. Inter's
 * three bold strings agree on one size to within 0.3%; Geist, which this was
 * set in before, disagrees by 4.7%.
 *
 * Colours are from the earlier, cleaner capture of the same bar. The newer
 * reference is a frame of a compressed stream and reads several stops darker —
 * that is the video, not the design.
 */

/** Ceiling on the bar's own height, whatever the source is set to. */
const MAX_BAR_PX = 120

const BAR = {
  background: "#203744",
  name: "#FFFFFF",
  provider: "#7D97A3",
  label: "#E5F2F9",
} as const

const PREVIEW_ROW: NowPlayingRow = {
  id: 1,
  slot_name: "Loan Shark",
  provider: "Paperclip Gaming",
  image_url: null,
  max_win: "25,000x",
  badge: "Only on Stake",
  best_win: 31665,
  source: "admin",
  updated_at: new Date().toISOString(),
}

/** Subscribes to the single now_playing row, with a poller as a safety net. */
function useNowPlaying(enabled: boolean) {
  const [row, setRow] = useState<NowPlayingRow | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!enabled) return
    const supabase = supabaseRef.current

    const fetchRow = async () => {
      const { data, error } = await supabase.from("now_playing").select("*").eq("id", 1).maybeSingle()
      if (error) {
        console.error("[v0] Error fetching now_playing:", error)
        return
      }
      setRow((data ?? null) as NowPlayingRow | null)
    }

    fetchRow()

    const channel = supabase
      .channel("now_playing_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "now_playing" }, (payload) => {
        setRow(payload.new as NowPlayingRow)
      })
      .subscribe()

    // The button that sets this is pressed in another browser, so a missed
    // realtime beat would leave the wrong game on stream until the next one.
    const poll = setInterval(fetchRow, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [enabled])

  return row
}

/** A fraction of the bar's height, as a CSS length. */
const u = (fraction: number) => `calc(var(--h) * ${fraction})`

/** A muted label with a bold figure after it — "Potential 25,000x". */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex shrink-0 items-baseline whitespace-nowrap" style={{ gap: u(0.25) }}>
      <span style={{ color: BAR.label, fontSize: u(0.34) }}>{label}</span>
      <span className="font-bold tabular-nums" style={{ color: BAR.name, fontSize: u(0.37) }}>
        {value}
      </span>
    </span>
  )
}

function NowPlaying() {
  const params = useSearchParams()
  const isPreview = params.get("preview") === "1"

  const live = useNowPlaying(!isPreview)
  const row = isPreview ? PREVIEW_ROW : live

  // Nothing playing: nothing drawn. Not an empty bar — a source that cannot
  // disappear has to be toggled by hand every time you leave a game.
  if (!isPlaying(row)) return null

  const showArt = params.get("art") === "1" && row.image_url
  const bestWin = formatMoney(row.best_win)

  return (
    <div
      className="h-screen w-full bg-transparent"
      style={{ ["--h" as string]: `min(100vh, ${MAX_BAR_PX}px)` }}
    >
      <div
        // Keyed on the game so the bar plays its entrance again on a change
        // rather than swapping text inside a bar that never moves.
        key={`${row.slot_name}|${row.updated_at}`}
        className="obs-now-playing flex w-full items-center overflow-hidden"
        style={{
          height: "var(--h)",
          backgroundColor: BAR.background,
          fontFamily: "var(--font-inter), Inter, sans-serif",
          padding: `0 ${u(0.61)}`,
          // The reference's own spacing: tight inside a pair, wide between
          // groups. Set per gap below rather than one gap for everything.
          gap: u(0.16),
        }}
      >
        {showArt && (
          <img
            src={row.image_url as string}
            alt=""
            className="shrink-0 object-cover"
            style={{ height: u(0.66), aspectRatio: "1 / 1", borderRadius: u(0.11) }}
          />
        )}

        {row.badge && (
          <span
            className="flex shrink-0 items-center whitespace-nowrap font-bold"
            style={{
              backgroundImage: BADGE_GRADIENT,
              color: BADGE_TEXT,
              height: u(0.5),
              // Solved, not chosen: the reference badge is 70px wide in a 44px
              // bar, and Inter 700 "Only on Stake" fills that at 8.6px with
              // 6.2px either side. Set by eye it came out 38px too wide, which
              // pushed every element after it 35px right.
              padding: `0 ${u(0.14)}`,
              borderRadius: u(0.15),
              fontSize: u(0.195),
              marginRight: u(0.74),
            }}
          >
            {row.badge}
          </span>
        )}

        {/* The one thing allowed to shrink. Everything else is a fixed chip;
            if the source is narrower than the bar wants, a clipped title reads
            as a long name and a clipped figure reads as a wrong number. */}
        <span
          className="min-w-0 flex-shrink overflow-hidden text-ellipsis whitespace-nowrap font-bold"
          style={{ color: BAR.name, fontSize: u(0.37), letterSpacing: "-0.005em" }}
        >
          {row.slot_name}
        </span>

        {row.provider && (
          <span
            className="shrink-0 whitespace-nowrap"
            style={{ color: BAR.provider, fontSize: u(0.37), marginRight: u(0.7) }}
          >
            {row.provider}
          </span>
        )}

        {row.max_win && <Stat label="Potential" value={row.max_win} />}

        {bestWin && (
          <span style={{ marginLeft: u(0.27) }}>
            <Stat label="Best Win" value={bestWin} />
          </span>
        )}
      </div>
    </div>
  )
}

export default function NowPlayingObsPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <NowPlaying />
    </Suspense>
  )
}
