"use client"

import Link from "next/link"
import { ArrowUpRight, Play } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"

/**
 * The pieces of the landing page.
 *
 * The page they replace was a table of contents: six links, six sentences of
 * prose, and two invented numbers. It linked to a live bonus hunt, a live
 * leaderboard and running raffles, and showed nothing from any of them. These
 * put the site's own state on its front page, so the thing you are being
 * invited to is visible before you click anything.
 */

/** The pulsing dot, used for anything genuinely happening now. */
export function LiveDot({ color = ACCENTS.red }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

/** The status line above the title: on air, or the next one, or nothing. */
export function StatusPill({
  live,
  label,
  detail,
}: {
  live: boolean
  label: string
  detail?: string
}) {
  const color = live ? ACCENTS.red : ACCENTS.blue
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5"
      style={{ borderColor: `${color}44`, backgroundColor: `${color}12` }}
    >
      {live ? <LiveDot color={color} /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      <MonoLabel style={{ color }}>{label}</MonoLabel>
      {detail && <span className="text-[12px] text-white/50">{detail}</span>}
    </div>
  )
}

/**
 * A card for something that is actually running.
 *
 * Rendered only when there is something to put in it — an empty "no hunt
 * running" card is the bareness this page is meant to fix, moved one level in.
 */
export function LiveCard({
  href,
  code,
  accent,
  headline,
  sub,
  children,
}: {
  href: string
  code: string
  accent: Accent
  headline: string
  sub?: string
  children?: React.ReactNode
}) {
  const color = ACCENTS[accent]
  return (
    <Link href={href} className="group block">
      <div
        className="relative h-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.022] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
        style={{ borderTopColor: `${color}55` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-[0.10]"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}, transparent 70%)` }}
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <MonoLabel style={{ color }}>{code}</MonoLabel>
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-white/20 transition group-hover:text-white/60" />
          </div>
          <p className="mt-2.5 text-[22px] font-bold leading-none tabular-nums text-white">{headline}</p>
          {sub && <p className="mt-1.5 text-[12px] text-white/40">{sub}</p>}
          {children && <div className="mt-3.5">{children}</div>}
        </div>
      </div>
    </Link>
  )
}

/** How far through a hunt is. The bar is the only chart on the page. */
export function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }}
      />
    </div>
  )
}

/** The top three of a board, small enough to sit inside a card. */
export function MiniPodium({ names }: { names: string[] }) {
  const colors = ["#E8C547", "#B9C0CC", "#C08552"]
  return (
    <ol className="space-y-1.5">
      {names.map((name, index) => (
        <li key={name + index} className="flex items-center gap-2 text-[12.5px]">
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ backgroundColor: colors[index], color: "#0B0B0D" }}
          >
            {index + 1}
          </span>
          <span className="min-w-0 truncate text-white/70">{name}</span>
        </li>
      ))}
    </ol>
  )
}

/** The two buttons under the title. */
export function HeroActions({ kickUrl, primary }: { kickUrl: string; primary?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <a
        href={kickUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#0B0B0D] transition hover:brightness-110"
        style={{ backgroundColor: "#53FC18" }}
      >
        <Play className="h-3 w-3 fill-current" />
        Watch on Kick
      </a>
      {primary && (
        <Link
          href={primary.href}
          className="inline-flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
        >
          {primary.label}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

/** A heading with a rule running off to the right. */
export function SectionRule({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="mt-12 flex items-center gap-3">
      <MonoLabel className="text-white/35">{label}</MonoLabel>
      <span className="h-px flex-1 bg-white/[0.08]" />
      {right}
    </div>
  )
}
