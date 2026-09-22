"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { BADGE_GRADIENT, BADGE_TEXT, isPlaying, type NowPlayingRow } from "@/lib/now-playing"

/**
 * The slot currently being played, as the casino's own info bar.
 *
 * Every colour here was sampled out of the reference screenshot rather than
 * matched by eye, and none of them come from the overlay's palette — this bar
 * is meant to read as the game's own strip, not as another Trinido panel:
 *
 *   bar          #203744   flat, 48% of the sampled pixels, no gradient
 *   badge        teal->blue gradient on #021D29 text (see BADGE_GRADIENT)
 *   slot name    #FFFFFF
 *   provider     #7D97A3
 *   Potential    #E5F2F9   measured near-white, not grey; the figure is
 *                          heavier rather than brighter
 *   Fun Play     #122533 / #768896
 *   Real Play    #455667 / #BACDDC
 *
 * Every size is a fraction of one length, --h, so the bar is the same shape at
 * 1920×72 as at 1280×48 and there is no correct size to get right in OBS.
 *
 * --h is min(100vh, MAX_BAR_PX) rather than plain 100vh, because a new browser
 * source in OBS defaults to 800×600: on pure vh that renders a screen-high
 * turquoise badge, which looks like the widget is broken rather than like the
 * source is the wrong size. Capped, an oversized source just shows a normal bar
 * at the top with transparency under it, which is obvious and harmless.
 */

/** Ceiling on the bar's own height, whatever the source is set to. */
const MAX_BAR_PX = 120

const BAR = {
  background: "#203744",
  name: "#FFFFFF",
  provider: "#7D97A3",
  potential: "#E5F2F9",
  funFill: "#122533",
  funText: "#768896",
  realFill: "#455667",
  realText: "#BACDDC",
} as const

const PREVIEW_ROW: NowPlayingRow = {
  id: 1,
  slot_name: "Thunder vs Underworld 250",
  provider: "Pragmatic Play",
  image_url: null,
  max_win: "25,000x",
  badge: "Only on Stake",
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

function PlayButton({ label, fill, color }: { label: string; fill: string; color: string }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center whitespace-nowrap font-semibold"
      style={{
        backgroundColor: fill,
        color,
        height: u(0.5),
        padding: `0 ${u(0.38)}`,
        borderRadius: u(0.11),
        fontSize: u(0.25),
      }}
    >
      {label}
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

  // Both default to the reference: the buttons are in it, the thumbnail is not.
  const showButtons = params.get("buttons") !== "0"
  const showArt = params.get("art") === "1" && row.image_url

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
          fontFamily: "Geist, sans-serif",
          padding: `0 ${u(0.42)}`,
          gap: u(0.28),
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
              height: u(0.53),
              padding: `0 ${u(0.22)}`,
              borderRadius: u(0.15),
              fontSize: u(0.28),
            }}
          >
            {row.badge}
          </span>
        )}

        {/* The one thing allowed to shrink. Everything else is a fixed chip;
            if the source is narrower than the bar wants, a clipped title reads
            as a long name and a clipped Real Play button reads as broken. */}
        <span
          className="min-w-0 flex-shrink overflow-hidden text-ellipsis whitespace-nowrap font-bold"
          style={{ color: BAR.name, fontSize: u(0.38), letterSpacing: "-0.01em" }}
        >
          {row.slot_name}
        </span>

        {row.provider && (
          <span className="shrink-0 whitespace-nowrap" style={{ color: BAR.provider, fontSize: u(0.32) }}>
            {row.provider}
          </span>
        )}

        {row.max_win && (
          // Set apart from the title group, as in the reference — it is a fact
          // about the game, not part of its name.
          <span
            className="flex shrink-0 items-baseline whitespace-nowrap"
            style={{ marginLeft: u(0.6), gap: u(0.16) }}
          >
            <span style={{ color: BAR.potential, fontSize: u(0.3) }}>Potential</span>
            <span className="font-bold tabular-nums" style={{ color: BAR.name, fontSize: u(0.33) }}>
              {row.max_win}
            </span>
          </span>
        )}

        {showButtons && (
          <span className="ml-auto flex shrink-0 items-center" style={{ gap: u(0.14) }}>
            <PlayButton label="Fun Play" fill={BAR.funFill} color={BAR.funText} />
            <PlayButton label="Real Play" fill={BAR.realFill} color={BAR.realText} />
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
