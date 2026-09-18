"use client"

import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
import { money, moneyExact } from "@/lib/leaderboard-format"
import { amountFor, metricLabel, otherMetric, type Metric } from "@/lib/leaderboard-metric"

/**
 * The board, in the shape people actually read it: the pool first, then the
 * three that matter, then the chase.
 *
 * The old page was a flat table with the prize pool as one tile among four.
 * That is the right layout for the admin and the wrong one for the page a
 * viewer opens to see whether they are still in the running.
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

function Avatar({ src, size, ring }: { src: string | null; size: number; ring?: string }) {
  const style = {
    width: size,
    height: size,
    ...(ring ? { borderColor: ring } : null),
  }
  if (!src) {
    return (
      <div
        className="shrink-0 rounded-full border-2 bg-white/[0.04]"
        style={{ borderColor: ring ?? "rgba(255,255,255,0.08)", ...style }}
      />
    )
  }
  return (
    <img
      src={src}
      alt=""
      className="shrink-0 rounded-full border-2 object-cover"
      style={{ borderColor: ring ?? "rgba(255,255,255,0.08)", ...style }}
    />
  )
}

/**
 * One podium column.
 *
 * `raised` is what makes first place read as first at a glance, before anyone
 * has read a number: a bigger avatar and a taller plinth.
 */
function PodiumSlot({ entry, raised, metric }: { entry: RankedEntry; raised: boolean; metric: Metric }) {
  const color = placeColor(entry.rank) ?? "rgba(255,255,255,0.2)"

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <Avatar src={entry.avatar_url} size={raised ? 72 : 56} ring={color} />

      <p className="mt-2 w-full truncate text-center text-[13px] font-semibold text-white">{entry.username}</p>
      <p className="mt-0.5 text-center text-[11.5px] tabular-nums text-white/35">
        {moneyExact(amountFor(entry, metric))}
      </p>

      <div
        className="mt-2.5 flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border px-2"
        style={{
          borderColor: `${color}44`,
          backgroundColor: `${color}0f`,
          height: raised ? 104 : 80,
        }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold tabular-nums"
          style={{ backgroundColor: color, color: "#0B0B0D" }}
        >
          {entry.rank}
        </span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {money(entry.prize_amount)}
        </span>
      </div>
    </div>
  )
}

/**
 * Second, first, third — left to right, the way a podium stands.
 *
 * A board with one or two entries still has a podium; it just has fewer steps.
 */
export function Podium({ top, metric }: { top: RankedEntry[]; metric: Metric }) {
  const [first, second, third] = top
  const order = [second, first, third].filter(Boolean) as RankedEntry[]
  if (order.length === 0) return null

  return (
    <div className="flex items-end gap-2.5 sm:gap-4">
      {order.map((entry) => (
        <PodiumSlot key={entry.id} entry={entry} raised={entry.rank === 1} metric={metric} />
      ))}
    </div>
  )
}

/** Everyone from fourth down. */
export function RankRow({ entry, metric }: { entry: RankedEntry; metric: Metric }) {
  const headline = amountFor(entry, metric)
  const other = otherMetric(metric)
  const secondary = amountFor(entry, other)

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="w-8 shrink-0 font-mono text-[12px] tabular-nums text-white/25">#{entry.rank}</span>

      <Avatar src={entry.avatar_url} size={32} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white">{entry.username}</p>
        <p className="truncate text-[11.5px] tabular-nums text-white/30">
          {metricLabel(metric)} {moneyExact(headline)}
          {/* The other figure only earns its space when there is one. On a
              wager race nobody has filled in earnings, and a column of
              "Earned $0.00" says nothing. */}
          {secondary !== 0 && (
            <span className="text-white/20">
              {" · "}
              {metricLabel(other)} {moneyExact(secondary)}
            </span>
          )}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <MonoLabel className="block text-white/25">Prize</MonoLabel>
        <p
          className="mt-1 text-[13px] font-semibold tabular-nums"
          style={{ color: entry.prize_amount > 0 ? "#46C48A" : "rgba(255,255,255,0.18)" }}
        >
          {entry.prize_amount > 0 ? money(entry.prize_amount) : "—"}
        </p>
      </div>
    </li>
  )
}

/**
 * The pool, the clock, the podium — everything the page is opened for, above
 * the fold and before a single scroll.
 *
 * Lives here rather than inline in the page so the preview harness renders the
 * same markup the site does, instead of a copy of it that can drift.
 */
export function BoardHero({
  prizePool,
  title,
  subtitle,
  countdown,
  podium,
  metric,
}: {
  prizePool: number
  title: string
  subtitle?: string | null
  countdown: string
  podium: RankedEntry[]
  metric: Metric
}) {
  const closed = countdown === "Closed"

  return (
    <Panel accent="amber" className="px-5 py-6 sm:px-7 sm:py-8">
      <div className="text-center">
        <p
          className="text-[42px] font-bold leading-none tracking-tight tabular-nums sm:text-[52px]"
          style={{ color: ACCENTS.amber }}
        >
          {money(prizePool)}
        </p>
        <MonoLabel className="mt-2.5 block text-white/35">Prize pool</MonoLabel>

        <p className="mt-3 text-[13px] text-white/45">
          {closed ? (
            "This board has closed."
          ) : (
            <>
              Ends in <span className="tabular-nums text-white/80">{countdown}</span>
            </>
          )}
        </p>

        <h1 className="mt-4 text-[15px] font-semibold text-white">{title}</h1>
        <p className="mt-1 text-[11.5px] text-white/30">
          {/* Two boards can look identical and be won by different people.
              Saying which number decides it is not decoration. */}
          Ranked by {metricLabel(metric).toLowerCase()}
        </p>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-white/35">{subtitle}</p>}
      </div>

      {podium.length > 0 && (
        <div className="mt-7">
          <Podium top={podium} metric={metric} />
        </div>
      )}
    </Panel>
  )
}
