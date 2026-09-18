"use client"

import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { money, moneyExact, moneyParts, ordinal } from "@/lib/leaderboard-format"
import { amountFor, metricLabel, type Metric } from "@/lib/leaderboard-metric"

/**
 * The board, laid out the way casino leaderboards are: a hero carrying the
 * pool, the top three as dealt cards, and the clock — then everyone else in a
 * plain table underneath.
 *
 * The three cards are the point of the shape. Stacked avatars read as a list
 * with bigger pictures; cards that lean in from either side read as a podium,
 * and the one facing you straight on is first.
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

  if (src) {
    return (
      <img
        src={src}
        alt=""
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

/** One line inside a podium card: a quiet label on the left, the figure right. */
function CardLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-black/30 px-2.5 py-1.5">
      <MonoLabel className="text-white/30">{label}</MonoLabel>
      <span
        className="truncate text-[12.5px] font-semibold tabular-nums"
        style={{ color: color ?? "rgba(255,255,255,0.8)" }}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * One of the three cards.
 *
 * `lean` tilts the outer two towards the middle. First place gets no tilt, a
 * coloured 2px edge and a little more height — it faces you, the others are
 * turned slightly away.
 */
type Lean = "left" | "right" | "none"

// Static class strings, because the tilt has to be a media query and an inline
// style cannot be one. Applied from lg up only: stacked in a single column, a
// tilted card is just a crooked card.
const LEAN_CLASS: Record<Lean, string> = {
  left: "lg:mt-8 lg:[transform:rotateY(8deg)]",
  right: "lg:mt-8 lg:[transform:rotateY(-8deg)]",
  none: "",
}

function PodiumCard({ entry, metric, lean }: { entry: RankedEntry; metric: Metric; lean: Lean }) {
  const color = placeColor(entry.rank) ?? "rgba(255,255,255,0.2)"
  const first = entry.rank === 1

  return (
    <div className={LEAN_CLASS[lean]}>
      <div
        className="relative h-full overflow-hidden rounded-xl border bg-white/[0.022] px-5 pb-5 pt-6 text-center"
        style={{ borderColor: first ? `${color}99` : "rgba(255,255,255,0.08)" }}
      >
        {/* A wash of the place colour behind the avatar, so the card is tinted
            without the border doing all the work. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-[0.14]"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}, transparent 70%)` }}
        />

        <div className="relative flex flex-col items-center">
          <Avatar src={entry.avatar_url} name={entry.username} size={first ? 68 : 56} ring={color} />

          <MonoLabel className="mt-3 block" style={{ color }}>
            {ordinal(entry.rank)} place
          </MonoLabel>

          <p className="mt-1.5 w-full truncate text-[15px] font-semibold text-white">{entry.username}</p>

          <div className="mt-4 w-full space-y-1.5">
            <CardLine label={metricLabel(metric)} value={moneyExact(amountFor(entry, metric))} />
            <CardLine label="Reward" value={money(entry.prize_amount)} color={color} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Second, first, third — left to right, the way a podium stands.
 *
 * Both the perspective and the tilt are `lg:` only — see LEAN_CLASS. On a
 * phone the three stack, and a tilted card in a single column is just a
 * crooked card.
 */
export function Podium({ top, metric }: { top: RankedEntry[]; metric: Metric }) {
  const [first, second, third] = top
  const order: { entry: RankedEntry; lean: Lean }[] = []
  if (second) order.push({ entry: second, lean: "left" })
  if (first) order.push({ entry: first, lean: "none" })
  if (third) order.push({ entry: third, lean: "right" })
  if (order.length === 0) return null

  return (
    <div className="mx-auto mt-9 grid max-w-3xl gap-4 sm:gap-5 lg:grid-cols-3 lg:[perspective:1600px]">
      {order.map(({ entry, lean }) => (
        <PodiumCard key={entry.id} entry={entry} metric={metric} lean={lean} />
      ))}
    </div>
  )
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; over: boolean }

/** The clock, as four tiles. Zero-padded so the row does not twitch each second. */
export function CountdownTiles({ left }: { left: Countdown }) {
  const tiles: [string, number][] = [
    ["Days", left.days],
    ["Hrs", left.hours],
    ["Mins", left.minutes],
    ["Secs", left.seconds],
  ]

  return (
    <div className="flex items-end justify-center gap-2.5">
      {tiles.map(([label, value]) => (
        <div key={label} className="text-center">
          <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>
          <div className="flex h-12 w-14 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[21px] font-semibold tabular-nums text-white sm:h-14 sm:w-16 sm:text-[24px]">
            {String(Math.max(0, value)).padStart(2, "0")}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Fourth place down: one table row. */
export function StandingRow({ entry, metric }: { entry: RankedEntry; metric: Metric }) {
  const headline = moneyParts(amountFor(entry, metric))
  const prize = moneyParts(entry.prize_amount)

  return (
    <tr className="border-b border-white/[0.04] text-[13px] transition hover:bg-white/[0.03] last:border-0">
      <td className="py-2.5 pl-3.5 pr-2 font-mono text-[11.5px] tabular-nums text-white/30">
        {ordinal(entry.rank)}
      </td>

      <td className="py-2.5 pr-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={entry.avatar_url} name={entry.username} size={28} />
          <span className="min-w-0 truncate font-medium text-white">{entry.username}</span>
        </div>
      </td>

      <td className="py-2.5 pr-2 text-right tabular-nums text-white/75">
        {headline.whole}
        <span className="text-white/30">{headline.cents}</span>
      </td>

      <td className="py-2.5 pr-3.5 text-right tabular-nums">
        {entry.prize_amount > 0 ? (
          <span style={{ color: ACCENTS.green }}>
            {prize.whole}
            <span className="opacity-50">{prize.cents}</span>
          </span>
        ) : (
          <span className="text-white/15">—</span>
        )}
      </td>
    </tr>
  )
}

/** The table around those rows, with its own header and empty state. */
export function StandingsTable({
  rows,
  metric,
  emptyNote,
}: {
  rows: RankedEntry[]
  metric: Metric
  emptyNote: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.015]">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08]">
            <th className="py-2.5 pl-3.5 pr-2 text-left font-normal">
              <MonoLabel className="text-white/30">Place</MonoLabel>
            </th>
            <th className="py-2.5 pr-2 text-left font-normal">
              <MonoLabel className="text-white/30">Player</MonoLabel>
            </th>
            <th className="py-2.5 pr-2 text-right font-normal">
              <MonoLabel className="text-white/30">{metricLabel(metric)}</MonoLabel>
            </th>
            <th className="py-2.5 pr-3.5 text-right font-normal">
              <MonoLabel className="text-white/30">Prize</MonoLabel>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-14 text-center text-[13px] text-white/25">
                {emptyNote}
              </td>
            </tr>
          ) : (
            rows.map((entry) => <StandingRow key={entry.id} entry={entry} metric={metric} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The hero: pool, title, board switch, podium, clock.
 *
 * Full-bleed with a curved bottom edge, the way these pages are built — the
 * curve is what separates the showpiece from the table without drawing a line
 * across the page.
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
}) {
  return (
    <section className="relative overflow-hidden rounded-b-[40px] border-b border-white/[0.06] bg-[#0E0E12] px-5 pb-12 pt-10 text-center sm:px-8 sm:pb-14">
      {/* One wash behind the pool. Sits under everything and takes no clicks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] max-w-none -translate-x-1/2 opacity-[0.10]"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${ACCENTS.amber}, transparent 65%)` }}
      />

      <div className="relative mx-auto max-w-5xl">
        <p
          className="text-[44px] font-bold leading-none tracking-tight tabular-nums sm:text-[60px]"
          style={{ color: ACCENTS.amber }}
        >
          {money(prizePool)}
        </p>
        <h1 className="mt-2 text-[17px] font-bold uppercase italic tracking-wide text-white sm:text-[22px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[12.5px] text-white/35">{subtitle}</p>}
        <MonoLabel className="mt-2 block text-white/25">Ranked by {metricLabel(metric)}</MonoLabel>

        {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
        {switcher && <div className="mt-5 flex justify-center">{switcher}</div>}

        <Podium top={podium} metric={metric} />

        <div className="mt-10">
          <MonoLabel className="mb-3 block text-white/30">
            {countdown.over ? "Closed" : "Time remaining"}
          </MonoLabel>
          <CountdownTiles left={countdown} />
          <p className="mt-3 text-[11.5px] text-white/25">{range}</p>
        </div>
      </div>
    </section>
  )
}
