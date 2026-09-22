"use client"

import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { BADGE_GRADIENT, BADGE_TEXT, formatMoney, type NowPlayingRow } from "@/lib/now-playing"

/**
 * The two strips that frame the game capture.
 *
 * Presentational only, and shared by three routes: /obs/casino-top,
 * /obs/now-playing and /obs/casino-frame. They were inline in the first two
 * until the frame needed them as well, and three copies of a bar whose sizes
 * were solved off a screenshot is three chances to fix one and forget the rest.
 *
 * Every size is a fraction of `--h`, the strip's own height, which the caller
 * sets. So a strip is the same shape whatever height it is given.
 *
 * Nothing here was matched by eye. Sizes come from the casino's own bar, which
 * measures 32px tall in the reference capture, and each number is that
 * measurement over 32:
 *
 *   text        0.40h throughout. Solved twice from different strings — the
 *               title/provider pair and the Potential pair — landing on 0.405
 *               and 0.398 independently. The title is NOT bigger than the
 *               provider, only bolder.
 *   badge       0.50h tall, text 0.26h. The text filling roughly half the chip
 *               is what makes it read as compact.
 *   badge gap   0.41h to the title.
 *   divider     1px, 0.69h tall, between the title group and the figures.
 *
 * The typeface was solved for rather than guessed: six candidates, each asked
 * what size reproduces the measured pixel width of six known strings. Inter's
 * three bold strings agree on one size to within 0.3%; Geist disagrees by 4.7%.
 */

export const STRIP = {
  background: "#203744",
  name: "#FFFFFF",
  /**
   * The provider and both stat labels are the same muted blue-grey — measured
   * at #94ACB8 and #9EB4C0, which is one colour plus antialiasing noise. Only
   * the title and the figures are white.
   */
  muted: "#94ACB8",
  divider: "#28404C",
} as const

export const FONT_STACK = "var(--font-inter), Inter, sans-serif"

/** A fraction of the strip's height, as a CSS length. */
export const u = (fraction: number) => `calc(var(--h) * ${fraction})`

/* -------------------------------------------------------------- top strip */

/**
 * The casino's icons, copied path-for-path out of its markup rather than
 * redrawn — a hand-traced bell next to a real one is the kind of near-miss that
 * reads as a mistake. Each keeps its original 20x20 viewBox.
 */
const ICONS: { name: string; path: string }[] = [
  {
    name: "Search",
    path: "m18.93 17.74-4.02-4.01a7.91 7.91 0 1 0-1.18 1.18l4.01 4q.26.25.6.25t.59-.24a.83.83 0 0 0 0-1.18M2.5 8.75a6.25 6.25 0 1 1 12.5 0 6.25 6.25 0 0 1-12.5 0",
  },
  {
    name: "Account",
    path: "M10 9.17a4.17 4.17 0 1 0 0-8.34 4.17 4.17 0 0 0 0 8.34m-2.5 1.66h5a6.66 6.66 0 0 1 6.67 6.67c0 .92-.75 1.67-1.67 1.67h-15c-.92 0-1.67-.75-1.67-1.67a6.66 6.66 0 0 1 6.67-6.67",
  },
  {
    name: "Notifications",
    path: "M16.3 11.85V7.3a6.3 6.3 0 1 0-12.6 0v4.55a2.25 2.25 0 0 0 .45 4.45h11.7a2.25 2.25 0 0 0 .45-4.45M10 19a3.6 3.6 0 0 0 3.1-1.8H6.9A3.6 3.6 0 0 0 10 19",
  },
  {
    name: "Sidebar",
    path: "M17.5.83h-15C1.58.83.83 1.58.83 2.5v15c0 .92.75 1.67 1.67 1.67h15c.92 0 1.67-.75 1.67-1.67v-15c0-.92-.75-1.67-1.67-1.67m-6.67 15.65c0 .56-.46 1.02-1.01 1.02h-6.3c-.56 0-1.02-.46-1.02-1.02V3.52c0-.56.46-1.02 1.02-1.02h6.3c.55 0 1.01.46 1.01 1.02z",
  },
]

function Icon({ name, path }: { name: string; path: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      role="img"
      aria-label={name}
      style={{ width: u(0.42), height: u(0.42), display: "block", flexShrink: 0 }}
    >
      <path fill={STRIP.muted} d={path} />
    </svg>
  )
}

/** Logo left, icons right. No data, no subscriptions — it is framing. */
export function CasinoTopStrip({ style }: { style?: CSSProperties }) {
  return (
    <div
      className="absolute flex items-center overflow-hidden"
      style={{
        height: "var(--h)",
        backgroundColor: STRIP.background,
        padding: `0 ${u(0.34)}`,
        ...style,
      }}
    >
      {/* A 2:1 white-on-transparent PNG, so it needs a height and nothing
          else; object-contain keeps it honest if that stops being 2:1. */}
      <img
        src="/stake-logo-white.png"
        alt="Stake"
        className="shrink-0 object-contain"
        style={{ height: u(0.4) }}
      />

      <span className="ml-auto flex shrink-0 items-center" style={{ gap: u(0.46) }}>
        {ICONS.map((icon) => (
          <Icon key={icon.name} {...icon} />
        ))}
      </span>
    </div>
  )
}

/* ----------------------------------------------------------- bottom strip */

/** A muted label with a bold figure after it — "Potential 25,000x". */
function Stat({ label, value, gap }: { label: string; value: string; gap?: number }) {
  return (
    <span
      className="flex shrink-0 items-baseline whitespace-nowrap"
      style={{ gap: u(0.22), marginLeft: gap ? u(gap) : undefined }}
    >
      <span style={{ color: STRIP.muted, fontSize: u(0.4) }}>{label}</span>
      <span className="font-bold tabular-nums" style={{ color: STRIP.name, fontSize: u(0.4) }}>
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
        backgroundColor: STRIP.divider,
        marginLeft: u(0.44),
        marginRight: u(0.44),
      }}
    />
  )
}

export function NowPlayingStrip({
  row,
  showArt,
  style,
}: {
  row: NowPlayingRow
  showArt?: boolean
  style?: CSSProperties
}) {
  const bestWin = formatMoney(row.best_win)
  const art = showArt && row.image_url

  return (
    <div
      // Keyed on the game so the strip plays its entrance again on a change
      // rather than swapping text inside a bar that never moves.
      key={`${row.slot_name}|${row.updated_at}`}
      className="obs-now-playing absolute flex items-center overflow-hidden"
      style={{
        height: "var(--h)",
        backgroundColor: STRIP.background,
        fontFamily: FONT_STACK,
        padding: `0 ${u(0.34)}`,
        // No shared gap. Every space in the reference is a different width, so
        // each one is set on the element it belongs to.
        gap: 0,
        ...style,
      }}
    >
      {art && (
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
            padding: `0 ${u(0.25)}`,
            borderRadius: u(0.15),
            fontSize: u(0.26),
            marginRight: u(0.41),
          }}
        >
          {row.badge}
        </span>
      )}

      {/* The one thing allowed to shrink. Everything else is a fixed chip; if
          the source is narrower than the strip wants, a clipped title reads as
          a long name and a clipped figure reads as a wrong number. */}
      <span
        className="min-w-0 flex-shrink overflow-hidden text-ellipsis whitespace-nowrap font-bold"
        style={{ color: STRIP.name, fontSize: u(0.4), letterSpacing: "-0.005em" }}
      >
        {row.slot_name}
      </span>

      {row.provider && (
        <span
          className="shrink-0 whitespace-nowrap"
          style={{ color: STRIP.muted, fontSize: u(0.4), marginLeft: u(0.18) }}
        >
          {row.provider}
        </span>
      )}

      {(row.max_win || bestWin) && <Divider />}

      {row.max_win && <Stat label="Potential" value={row.max_win} />}
      {bestWin && <Stat label="Best Win" value={bestWin} gap={row.max_win ? 0.44 : 0} />}
    </div>
  )
}

/* ------------------------------------------------------------------- data */

export const PREVIEW_ROW: NowPlayingRow = {
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
export function useNowPlaying(enabled: boolean) {
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
