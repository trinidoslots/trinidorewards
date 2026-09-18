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
      {/* One coloured edge, per the shared surface language. The wash that
          used to sit behind this was a filled block of colour, which is the
          thing that language exists to avoid. */}
      <div
        className="relative h-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.022] p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
        style={{ borderLeft: `2px solid ${color}` }}
      >
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

/**
 * The top three of a board, small enough to sit inside a card.
 *
 * Gold, silver and bronze belong on the leaderboard's own podium, where the
 * cards are large and the placing is the point. Three more hues for three
 * 16px discs on the landing page is just three more hues; rank reads fine
 * from the number and the order.
 */
export function MiniPodium({ names }: { names: string[] }) {
  return (
    <ol className="space-y-1.5">
      {names.map((name, index) => (
        <li key={name + index} className="flex items-center gap-2 text-[12.5px]">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.12] font-mono text-[9px] tabular-nums text-white/45">
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
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition hover:brightness-125"
        style={{ borderColor: `${ACCENTS.blue}77`, backgroundColor: `${ACCENTS.blue}1f`, color: ACCENTS.blue }}
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

/**
 * A tile in the bento grid.
 *
 * Six identical cards in a 3×2 grid is a menu, and it reads as one — nothing
 * on it is more important than anything else, so the eye has nowhere to land.
 * `span` lets the flagship take twice the room and gives the grid a shape.
 */
export function BentoTile({
  href,
  code,
  accent,
  title,
  copy,
  icon: Icon,
  span = false,
  children,
}: {
  href: string
  code: string
  accent: Accent
  title: string
  copy: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  span?: boolean
  children?: React.ReactNode
}) {
  const color = ACCENTS[accent]
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5 transition hover:border-white/20 hover:bg-white/[0.04] sm:p-6 ${
        span ? "sm:col-span-2" : ""
      }`}
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.10]">
            <Icon className="h-4 w-4" style={{ color }} />
          </span>
          <MonoLabel style={{ color }}>{code}</MonoLabel>
          <ArrowUpRight className="ml-auto h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/70" />
        </div>

        <h3 className={`mt-4 font-semibold text-white ${span ? "text-[20px]" : "text-[16px]"}`}>{title}</h3>
        <p className={`mt-2 leading-[1.65] text-white/40 ${span ? "max-w-md text-[13.5px]" : "text-[12.5px]"}`}>
          {copy}
        </p>

        {children && <div className="mt-auto pt-5">{children}</div>}
      </div>
    </Link>
  )
}

/** One of the three numbered steps. */
export function Step({ n, title, copy }: { n: number; title: string; copy: string }) {
  return (
    <div className="relative pl-12">
      <span
        className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-[12px] tabular-nums text-white/50"
      >
        {n}
      </span>
      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-[1.7] text-white/40">{copy}</p>
    </div>
  )
}
