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
 * Nothing here was matched by eye. Sizes come from the casino's own bar, which
 * measures 32px tall in the reference capture, and each number below is that
 * measurement over 32:
 *
 *   text        0.40h throughout. Solved twice from different strings — the
 *               title/provider pair and the Potential pair — landing on 0.405
 *               and 0.398 independently. The title is NOT bigger than the
 *               provider, only bolder.
 *   badge       0.50h tall, text 0.26h. The text filling roughly half the chip
 *               is what makes it read as compact; a smaller label in the same
 *               chip looks like an empty pill, which is what it was.
 *   badge gap   0.41h to the title. It sits close, not set apart.
 *   divider     1px, #28404C, 0.69h tall, between the title group and the
 *               figures.
 *
 * The typeface was solved for rather than guessed: six candidates, each asked
 * what size reproduces the measured pixel width of six known strings. Inter's
 * three bold strings agree on one size to within 0.3%; Geist, which this was
 * set in before, disagrees by 4.7%.
 */

/**
 * Ceiling on the bar's height when it is sizing itself off the source.
 *
 * ?h=40 pins it instead, which is the answer to a blurry overlay: set the OBS
 * source to the exact pixels it occupies on the canvas and never resize the
 * box. A source rendered at 960 wide and stretched to 1920 is drawing 960
 * pixels of text and asking OBS to invent the rest.
 */
const MAX_BAR_PX = 120

const BAR = {
  background: "#203744",
  name: "#FFFFFF",
  /**
   * The provider and both stat labels are the same muted blue-grey — measured
   * at #94ACB8 and #9EB4C0 in the reference, which is one colour plus
   * antialiasing noise.
   *
   * These were #7D97A3 and #E5F2F9: a shade too dull, and a label that was
   * nearly white. The earlier near-white reading came from averaging the
   * brightest pixels of thin antialiased type in a region that also caught the
   * bold figure beside it. Splitting the words first gives the real value, and
   * only the name and the figures are white.
   */
  muted: "#94ACB8",
  divider: "#28404C",
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
function Stat({ label, value, gap }: { label: string; value: string; gap?: number }) {
  return (
    <span
      className="flex shrink-0 items-baseline whitespace-nowrap"
      style={{ gap: u(0.22), marginLeft: gap ? u(gap) : undefined }}
    >
      <span style={{ color: BAR.muted, fontSize: u(0.4) }}>{label}</span>
      <span className="font-bold tabular-nums" style={{ color: BAR.name, fontSize: u(0.4) }}>
        {value}
      </span>
    </span>
  )
}

/** The hairline between the title group and the figures. */
function Divider() {
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{
        width: 1,
        height: u(0.69),
        backgroundColor: BAR.divider,
        marginLeft: u(0.44),
        marginRight: u(0.44),
      }}
    />
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

  // ?h=40 pins the bar height; otherwise it fills the source up to the cap.
  const pinned = Number(params.get("h"))
  const height = Number.isFinite(pinned) && pinned > 0 ? `${pinned}px` : `min(100vh, ${MAX_BAR_PX}px)`

  return (
    <div className="h-screen w-full bg-transparent" style={{ ["--h" as string]: height }}>
      <div
        // Keyed on the game so the bar plays its entrance again on a change
        // rather than swapping text inside a bar that never moves.
        key={`${row.slot_name}|${row.updated_at}`}
        className="obs-now-playing flex w-full items-center overflow-hidden"
        style={{
          height: "var(--h)",
          backgroundColor: BAR.background,
          fontFamily: "var(--font-inter), Inter, sans-serif",
          padding: `0 ${u(0.34)}`,
          // No shared gap. Every space in the reference is a different width,
          // so each one is set on the element it belongs to.
          gap: 0,
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
              // The chip reads compact because the label fills about half of
              // it. At 0.195h in the same 0.5h chip it was a big empty pill
              // with small type in it, which is what "too tall" meant.
              padding: `0 ${u(0.25)}`,
              borderRadius: u(0.15),
              fontSize: u(0.26),
              marginRight: u(0.41),
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
          style={{ color: BAR.name, fontSize: u(0.4), letterSpacing: "-0.005em" }}
        >
          {row.slot_name}
        </span>

        {row.provider && (
          <span
            className="shrink-0 whitespace-nowrap"
            style={{ color: BAR.muted, fontSize: u(0.4), marginLeft: u(0.18) }}
          >
            {row.provider}
          </span>
        )}

        {(row.max_win || bestWin) && <Divider />}

        {row.max_win && <Stat label="Potential" value={row.max_win} />}
        {bestWin && <Stat label="Best Win" value={bestWin} gap={row.max_win ? 0.44 : 0} />}
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
