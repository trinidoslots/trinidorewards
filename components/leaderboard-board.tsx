"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { money, moneyExact, moneyParts, ordinal } from "@/lib/leaderboard-format"
import { amountFor, metricLabel, type Metric } from "@/lib/leaderboard-metric"
import { Swap } from "@/components/swap"
import { Clock } from "@/components/landing/parts"

/**
 * The board, in the landing page's language: a header with the board's name
 * on the left and its pool and clock in a panel on the right, the top three as
 * a podium of cards, then everyone else as rows in one panel.
 */

export type RankedEntry = {
  id: string
  username: string
  avatar_url: string | null
  total_wagered: number
  total_earned: number
  prize_amount: number
  rank: number
}

/** Gold, silver, bronze. */
export const PLACE_COLORS = ["#E8C547", "#B9C0CC", "#C08552"] as const

export function placeColor(rank: number): string | null {
  return PLACE_COLORS[rank - 1] ?? null
}

/**
 * A picture when there is one, the initial when there is not.
 *
 * A grid of identical blank discs tells you nothing about who is who; a letter
 * at least distinguishes them.
 *
 * The external feed hands back avatars hosted by Facebook, Google or Dicebear,
 * and the first two expire. A dead URL is not the same as no URL: the browser
 * draws its own broken-image glyph, which looks like the page is broken rather
 * than like a player without a picture. So a failed load falls back to the same
 * initial, and `referrerPolicy` is set because those hosts return 403 for a
 * request that names where it came from.
 */
export function Avatar({
  src,
  name,
  size,
  ring,
}: {
  src: string | null
  name: string
  size: number
  ring?: string
}) {
  const border = ring ?? "rgba(255,255,255,0.10)"
  const [broken, setBroken] = useState(false)

  // Rows keep their place while the board refreshes, so the same component can
  // be handed a different picture. Without this reset it would stay on the
  // initial for the rest of the session.
  useEffect(() => setBroken(false), [src])

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full border-2 object-cover"
        style={{ width: size, height: size, borderColor: border }}
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 bg-white/[0.04] font-semibold uppercase text-white/50"
      style={{ width: size, height: size, borderColor: border, fontSize: Math.round(size * 0.38) }}
    >
      {(name || "?").trim().charAt(0)}
    </div>
  )
}

/**
 * One podium card.
 *
 * First is taller and carries a stronger wash; all three show the place's
 * colour on the ring, the label and the prize. The large numeral behind is
 * texture, outlined so it never competes with the name.
 *
 * The cards count down on arrival: third, then second, then first, each a
 * beat apart (see .podium-* in globals.css). Each numeral arrives solid in
 * the place colour and settles into the outline; first place glows once as
 * it lands. `step` is the card's place in that sequence.
 */
const PODIUM_STEP_MS = 420

function PodiumCard({ entry, metric, step }: { entry: RankedEntry; metric: Metric; step: number }) {
  const color = placeColor(entry.rank) ?? "rgba(255,255,255,0.4)"
  const first = entry.rank === 1
  const motion = {
    ["--podium-delay" as string]: `${150 + step * PODIUM_STEP_MS}ms`,
    ["--podium-color" as string]: color,
  } as React.CSSProperties

  return (
    <div
      // Stacked on a phone the order is 1, 2, 3; side by side it is the
      // podium's own 2, 1, 3, with first raised in the middle.
      className={`podium-card relative overflow-hidden rounded-3xl border bg-[#0E0E12] px-6 text-center ${
        first ? "podium-first order-first pb-7 pt-9 sm:order-none sm:pb-9 sm:pt-12" : "pb-6 pt-7 sm:pb-7 sm:pt-8"
      }`}
      style={{ ...motion, borderColor: first ? `${color}66` : "rgba(255,255,255,0.08)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}${first ? "33" : "1f"}, transparent 70%)` }}
      />
      <span
        aria-hidden
        className="podium-numeral pointer-events-none absolute -right-1 -top-5 select-none text-[120px] font-black leading-none text-transparent"
        style={{ WebkitTextStroke: `1px ${color}26` }}
      >
        {entry.rank}
      </span>
      {/* The same numeral, solid, for the arrival only: it lands and fades,
          leaving the outline above in its place. */}
      <span
        aria-hidden
        className="podium-flash pointer-events-none absolute -right-1 -top-5 select-none text-[120px] font-black leading-none"
        style={{ color }}
      >
        {entry.rank}
      </span>

      <div className="relative flex flex-col items-center">
        <Avatar src={entry.avatar_url} name={entry.username} size={first ? 84 : 68} ring={color} />
        <MonoLabel className="mt-4 block" style={{ color }}>
          {ordinal(entry.rank)} place
        </MonoLabel>
        <p className={`mt-2 w-full truncate font-bold text-white ${first ? "text-[20px]" : "text-[17px]"}`}>
          {entry.username}
        </p>

        <p className={`mt-5 font-black leading-none tabular-nums ${first ? "text-[36px]" : "text-[28px]"}`} style={{ color }}>
          {entry.prize_amount > 0 ? money(entry.prize_amount) : "—"}
        </p>
        <MonoLabel className="mt-2 block text-white/35">Prize</MonoLabel>

        <div className="mt-5 w-full rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5">
          <p className="text-[15px] font-semibold tabular-nums text-white/85">{moneyExact(amountFor(entry, metric))}</p>
          <MonoLabel className="mt-1 block text-white/30">{metricLabel(metric)}</MonoLabel>
        </div>
      </div>
    </div>
  )
}

/** Second, first, third — left to right, the way a podium stands. */
export function Podium({ top, metric }: { top: RankedEntry[]; metric: Metric }) {
  const [first, second, third] = top
  const order = [second, first, third].filter((entry): entry is RankedEntry => !!entry)
  if (order.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
      {order.map((entry) => (
        // Lowest place first: with three on the podium, third is step 0 and
        // first is step 2; with two, second goes first.
        <PodiumCard key={entry.id} entry={entry} metric={metric} step={top.length - entry.rank} />
      ))}
    </div>
  )
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; over: boolean }

/** Fourth place down: one row. */
export function StandingRow({ entry, metric, leader }: { entry: RankedEntry; metric: Metric; leader: number }) {
  const amount = amountFor(entry, metric)
  const headline = moneyParts(amount)
  const prize = moneyParts(entry.prize_amount)
  // How far off the leader, as a bar under the name. Linear: this is a share
  // of the same pot, and the gap is the point.
  const share = leader > 0 ? Math.max(0, Math.min(1, amount / leader)) : 0
  const paid = entry.prize_amount > 0

  return (
    <li className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto_5.5rem] items-center gap-x-3 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[3.5rem_minmax(0,1fr)_8rem_7rem] sm:px-6">
      <span className="font-mono text-[12px] tabular-nums text-white/35">{ordinal(entry.rank)}</span>

      <span className="flex min-w-0 items-center gap-3">
        <Avatar src={entry.avatar_url} name={entry.username} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-white">{entry.username}</span>
          <span className="mt-1.5 block h-[3px] w-full max-w-[10rem] overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(2, share * 100)}%`, backgroundColor: paid ? ACCENTS.green : "rgba(255,255,255,0.25)" }}
            />
          </span>
        </span>
      </span>

      <span className="text-right text-[13.5px] tabular-nums text-white/75">
        {headline.whole}
        <span className="text-white/30">{headline.cents}</span>
      </span>

      <span className="text-right text-[13.5px] font-semibold tabular-nums">
        {paid ? (
          <span style={{ color: ACCENTS.green }}>
            {prize.whole}
            <span className="opacity-50">{prize.cents}</span>
          </span>
        ) : (
          <span className="text-white/15">—</span>
        )}
      </span>
    </li>
  )
}

/** The rows, in one panel, with the search and totals in its header. */
export function StandingsTable({
  rows,
  metric,
  emptyNote,
  leader,
  toolbar,
}: {
  rows: RankedEntry[]
  metric: Metric
  emptyNote: string
  /** First place's amount, for the bars. */
  leader: number
  toolbar?: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E12]">
      {toolbar && <div className="border-b border-white/[0.07] px-4 py-4 sm:px-6">{toolbar}</div>}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto_5.5rem] gap-x-3 border-b border-white/[0.05] px-4 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_8rem_7rem] sm:px-6">
        <MonoLabel className="text-white/30">Place</MonoLabel>
        <MonoLabel className="text-white/30">Player</MonoLabel>
        <MonoLabel className="text-right text-white/30">{metricLabel(metric)}</MonoLabel>
        <MonoLabel className="text-right text-white/30">Prize</MonoLabel>
      </div>
      {rows.length === 0 ? (
        <p className="py-14 text-center text-[13px] text-white/30">{emptyNote}</p>
      ) : (
        <ol>
          {rows.map((entry) => (
            <StandingRow key={entry.id} entry={entry} metric={metric} leader={leader} />
          ))}
        </ol>
      )}
    </div>
  )
}

/**
 * The header: board switch, title and dates on the left, the pool and the
 * clock in a panel on the right, then the podium across the full width.
 */
export function BoardHero({
  prizePool,
  title,
  subtitle,
  metric,
  podium,
  countdown,
  range,
  switcher,
  actions,
  swapKey,
  swapReady,
}: {
  prizePool: number
  title: string
  subtitle?: string | null
  metric: Metric
  podium: RankedEntry[]
  countdown: Countdown
  range: string
  switcher?: React.ReactNode
  actions?: React.ReactNode
  /** Changes when the board does; everything below the switcher re-enters. */
  swapKey: string
  /** False while the board named by swapKey is still being fetched. */
  swapReady?: boolean
}) {
  const color = ACCENTS.amber
  const long = title.length > 22

  return (
    // data-no-reveal: like PageHero, this replaces the loading header in
    // place and must not animate in a second time.
    <section data-no-reveal className="relative w-full overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(900px 420px at 85% -20%, ${color}24, transparent 62%), #08080A` }}
      />
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-0"
        style={{
          maskImage: "radial-gradient(ellipse 70% 70% at 70% 0%, #000 25%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 70% 0%, #000 25%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-10 lg:px-8 lg:pt-14">
        {/*
          The switcher sits above everything that changes, and outside the
          animation, because it is the control. It used to be inside: you
          clicked a board and the button you had just pressed faded to nothing
          and slid upwards under your cursor. A control that leaves when you
          use it reads as a glitch, whatever the timing.
        */}
        {switcher && <div className="mb-7">{switcher}</div>}

        <Swap on={swapKey} ready={swapReady}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: color }} />
                <MonoLabel style={{ color }}>Leaderboard · ranked by {metricLabel(metric).toLowerCase()}</MonoLabel>
              </div>
              <h1
                className={`mt-4 break-words font-black uppercase leading-[0.92] tracking-[-0.01em] text-white ${
                  long ? "text-[clamp(30px,4.6vw,52px)]" : "text-[clamp(40px,6.4vw,76px)]"
                }`}
              >
                {title}
              </h1>
              {subtitle && <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/50">{subtitle}</p>}
              <p className="mt-4 text-[12.5px] text-white/35">{range}</p>
              {actions && <div className="mt-6 flex flex-wrap items-center gap-2.5">{actions}</div>}
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/[0.10] bg-[#0E0E12]/90 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur sm:p-7">
              <div className="border-b border-white/[0.07] pb-6">
                <MonoLabel style={{ color }}>Prize pool</MonoLabel>
                <p className="mt-3 text-[clamp(40px,5vw,56px)] font-black leading-none tabular-nums tracking-[-0.02em] text-white">
                  {money(prizePool)}
                </p>
              </div>
              <div className="pt-6">
                <MonoLabel className="mb-4 block text-white/45">{countdown.over ? "Closed" : "Ends in"}</MonoLabel>
                <Clock left={countdown} accent={color} />
              </div>
            </div>
          </div>

          {podium.length > 0 && (
            <div className="mt-14">
              <Podium top={podium} metric={metric} />
            </div>
          )}
        </Swap>
      </div>
    </section>
  )
}

/**
 * BoardHero's own shape with placeholders, for while the boards load.
 *
 * The loading state used to be a generic "Leaderboard" PageHero, swapped for
 * the board's header the moment it arrived — a different title, a different
 * layout, one header replaced by another. This keeps every edge where the
 * real header will put it, so loading reads as the same header filling in.
 */
export function BoardHeroSkeleton() {
  const color = ACCENTS.amber
  return (
    <section data-no-reveal className="relative w-full overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(900px 420px at 85% -20%, ${color}24, transparent 62%), #08080A` }}
      />
      <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-10 lg:px-8 lg:pt-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: color }} />
              <MonoLabel style={{ color }}>Leaderboard</MonoLabel>
            </div>
            <div className="mt-5 h-[clamp(36px,5.6vw,66px)] w-4/5 max-w-xl animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="mt-5 h-3.5 w-56 animate-pulse rounded bg-white/[0.05]" />
          </div>
          <div className="h-[268px] animate-pulse rounded-3xl border border-white/[0.08] bg-white/[0.03]" />
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="h-[300px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
          <div className="order-first h-[340px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.03] sm:order-none" />
          <div className="h-[300px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
        </div>
      </div>
    </section>
  )
}
