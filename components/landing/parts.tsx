"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { animate } from "framer-motion"
import { Play } from "lucide-react"
import { MonoLabel } from "@/components/ui/panel"
import { money } from "@/lib/leaderboard-format"
import type { Countdown } from "@/lib/schedule-week"

/**
 * The small pieces the landing page is built from.
 *
 * The redesign keeps the board palette (components/ui/panel.tsx) for
 * everything the site owns, and adds one colour it does not: Kick's own green,
 * used only on the buttons that leave for Kick. It is the colour people already
 * associate with the place the stream is, so the way out reads at a glance.
 */

export const KICK_URL = "https://kick.com/trinidoslots"
export const KICK_GREEN = "#53FC18"

/** The pulsing dot, used for anything genuinely happening now. */
export function LiveDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span className="relative flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <span className="relative inline-flex h-full w-full rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

/** The filled button that leaves for Kick. */
export function KickButton({ size = "md", label = "Watch on Kick" }: { size?: "md" | "lg"; label?: string }) {
  return (
    <a
      href={KICK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2.5 rounded-xl font-bold text-black transition hover:brightness-110 active:scale-[0.98] ${
        size === "lg" ? "px-7 py-4 text-[15px]" : "px-5 py-3 text-[14px]"
      }`}
      style={{ backgroundColor: KICK_GREEN, boxShadow: `0 10px 40px -12px ${KICK_GREEN}99` }}
    >
      <Play className="h-4 w-4 fill-current transition group-hover:scale-110" />
      {label}
    </a>
  )
}

/**
 * Days, hours, minutes and seconds as four tiles.
 *
 * Digits are padded so the tiles do not change width as the seconds tick,
 * which on a monospace face would still shift the labels under them.
 */
export function Clock({ left, accent }: { left: Countdown; accent: string }) {
  const units: [number, string][] = [
    [left.days, "Days"],
    [left.hours, "Hrs"],
    [left.minutes, "Min"],
    [left.seconds, "Sec"],
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {units.map(([value, label]) => (
        <div
          key={label}
          className="rounded-xl border border-white/[0.08] bg-black/40 px-2 py-3 text-center"
        >
          <p className="font-mono text-[28px] font-semibold leading-none tabular-nums text-white sm:text-[32px]">
            {String(value).padStart(2, "0")}
          </p>
          <MonoLabel className="mt-2 block" style={{ color: `${accent}cc` }}>
            {label}
          </MonoLabel>
        </div>
      ))}
    </div>
  )
}

/**
 * A section heading: a big title on the left, an optional link on the right,
 * a short accent rule above. Bigger than the old mono label with a hairline —
 * the sections are the page now, not footnotes under the hero.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  right,
}: {
  eyebrow: string
  title: string
  accent: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: accent }} />
          <MonoLabel style={{ color: accent }}>{eyebrow}</MonoLabel>
        </div>
        <h2 className="mt-3 text-[clamp(28px,4vw,44px)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-white">
          {title}
        </h2>
      </div>
      {right}
    </div>
  )
}

/**
 * A dollar figure that counts up from zero the first time it appears.
 *
 * Not AnimatedAmount: that one is built for signed deltas and always prints a
 * "+" or "-", which on a running total reads as a change rather than a sum.
 */
export function CountUp({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value)
      return
    }
    const controls = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setShown })
    return () => controls.stop()
  }, [value])
  return (
    <span className={className} style={style}>
      {money(Math.round(shown))}
    </span>
  )
}

/** "3d 4h 12m", or the fallback once the time is up. */
export function shortLeft(left: Countdown | null, fallback: string): string {
  if (!left || left.over) return fallback
  if (left.days > 0) return `${left.days}d ${left.hours}h ${left.minutes}m`
  if (left.hours > 0) return `${left.hours}h ${left.minutes}m`
  return `${left.minutes}m ${left.seconds}s`
}
