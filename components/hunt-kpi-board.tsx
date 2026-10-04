import type { ReactNode } from "react"
import { Crown, ImageIcon, Sparkles, TrendingUp } from "lucide-react"
import type { HuntKpis } from "@/lib/active-hunt"
import { ACCENTS } from "@/components/ui/panel"
import { BentoFrame, BracketLabel, CardFooter, DotPanel, PulseDot } from "@/components/ui/shell-kit"

export type HuntBonusRow = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  is_super: boolean
  image_url?: string | null
}

type Props = {
  hunts: HuntBonusRow[]
  kpis: HuntKpis | null
  fallbackStartingBalance?: number
  sidePanel?: ReactNode
  tableTitle?: string
  tableEyebrow?: string
}

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * The hunt board, shared by the live Bonus Hunt page and Previous hunts, so
 * both always render the same layout off the same `bonus_hunt_kpis` +
 * `hunt_bonuses` data shape.
 *
 * Three tiers, in the landing page's language: a scoreboard that leads with
 * what the hunt has paid and what the rest of it has to do (break-even), the
 * two records with their slots, and the bonus list. Every derived figure is
 * computed exactly as before — only the presentation changed.
 */
export function HuntKpiBoard({
  hunts,
  kpis,
  fallbackStartingBalance = 0,
  sidePanel,
  tableTitle = "Current bonus hunt",
  tableEyebrow = "Live board",
}: Props) {
  const usingKpis = !!kpis
  const completed = hunts.filter((hunt) => hunt.result !== null && hunt.result > 0)
  const remaining = hunts.filter((hunt) => hunt.result === null || hunt.result === 0)
  const total = hunts.length
  const totalBet = hunts.reduce((sum, hunt) => sum + Number(hunt.bet_size), 0)
  const totalWinsLocal = hunts.reduce((sum, hunt) => sum + (Number(hunt.result) || 0), 0)

  const startingBalanceVal = usingKpis ? Number(kpis!.starting_balance) : fallbackStartingBalance
  const totalWonVal = usingKpis ? Number(kpis!.total_won) : totalWinsLocal
  const profitLoss = totalWonVal - startingBalanceVal

  const remainingStakes = remaining.reduce((sum, hunt) => sum + Number(hunt.bet_size), 0)
  const breakEven = remainingStakes > 0 ? Math.max(0, (startingBalanceVal - totalWonVal) / remainingStakes) : 0

  const averageMultiplierLocal = completed.length
    ? completed.reduce((sum, hunt) => sum + Number(hunt.result) / Number(hunt.bet_size), 0) / completed.length
    : 0
  const averageMultiplier = usingKpis ? Number(kpis!.average_multi) : averageMultiplierLocal
  const averageBet = usingKpis ? Number(kpis!.average_bet) : total ? totalBet / total : 0
  const remainingCount = usingKpis ? kpis!.remaining : remaining.length

  const highestMultiplierLocal = completed.reduce(
    (best, hunt) =>
      Number(hunt.result) / Number(hunt.bet_size) > best.value
        ? { value: Number(hunt.result) / Number(hunt.bet_size), game: hunt.game_name }
        : best,
    { value: 0, game: "" },
  )
  const highestWinLocal = completed.reduce(
    (best, hunt) => (Number(hunt.result) > best.value ? { value: Number(hunt.result), game: hunt.game_name } : best),
    { value: 0, game: "" },
  )

  const bestMultiplier = usingKpis ? Number(kpis!.best_multiplier) : highestMultiplierLocal.value
  const bestMultiplierGame = usingKpis ? kpis!.best_multiplier_game || "" : highestMultiplierLocal.game
  const bestCashWin = usingKpis ? Number(kpis!.best_cash_win) : highestWinLocal.value
  const bestCashWinGame = usingKpis ? kpis!.best_cash_win_game || "" : highestWinLocal.game

  const imageFor = (game: string) => hunts.find((hunt) => hunt.game_name === game && hunt.image_url)?.image_url ?? null
  // The first unopened bonus in list order is the one being opened next.
  const nextId = hunts.find((hunt) => hunt.result === null)?.id ?? null

  const opened = completed.length
  const percent = total ? Math.round((opened / total) * 100) : 0
  const done = total > 0 && remainingCount === 0

  return (
    <div className="flex flex-col gap-4">
      {/* --- scoreboard: the totals over a matrix of every bonus ------------- */}
      <BentoFrame glow={ACCENTS.amber} glowAlways>
        <DotPanel glow={ACCENTS.amber} className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
            <div className="min-w-0">
              <BracketLabel style={{ color: ACCENTS.amber }}>Total won</BracketLabel>
              <p className="mt-3 text-[clamp(40px,5.4vw,64px)] font-semibold leading-none tracking-[-0.045em] tabular-nums text-white">
                {money(totalWonVal)}
              </p>
              <p className="mt-3 text-[14px] text-white/45">
                <span className="font-medium tabular-nums" style={{ color: profitLoss >= 0 ? ACCENTS.green : ACCENTS.red }}>
                  {profitLoss >= 0 ? "+" : "−"}
                  {money(Math.abs(profitLoss))}
                </span>{" "}
                against a {money(startingBalanceVal)} start
              </p>
            </div>

            {/* The one number a live hunt is watched for. Finished, break-even
                means nothing; what came back does. */}
            <div
              className="min-w-[13rem] rounded-xl border px-5 py-4"
              style={{ borderColor: `${ACCENTS.amber}40`, backgroundColor: `${ACCENTS.amber}0d` }}
            >
              <BracketLabel style={{ color: ACCENTS.amber }}>{done ? "Hunt complete" : "Break even"}</BracketLabel>
              <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: ACCENTS.amber }}>
                {done
                  ? `${startingBalanceVal > 0 ? Math.round((totalWonVal / startingBalanceVal) * 100) : 0}%`
                  : `${breakEven.toFixed(2)}x`}
              </p>
              <p className="mt-2 text-[12.5px] text-white/45">
                {done ? "of the starting balance returned" : `average needed on the ${remainingCount} still to open`}
              </p>
            </div>
          </div>

          {total > 0 && <BonusMatrix hunts={hunts} nextId={nextId} />}
        </DotPanel>
        <CardFooter
          index="01"
          label="Scoreboard"
          status={
            <>
              <PulseDot color={ACCENTS.amber} pulse={!done && total > 0} />
              {opened} of {total} opened · {percent}%
            </>
          }
        />
      </BentoFrame>

      {/* --- the running figures ------------------------------------------- */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Starting balance", money(startingBalanceVal)],
          ["Average multi", `${averageMultiplier.toFixed(2)}x`],
          ["Average bet", money(averageBet)],
          ["Remaining", `${remainingCount}`],
        ].map(([label, value]) => (
          <BentoFrame key={label}>
            <div className="px-3 py-3">
              <dt>
                <BracketLabel>{label}</BracketLabel>
              </dt>
              <dd className="mt-3 text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">{value}</dd>
            </div>
          </BentoFrame>
        ))}
      </dl>

      {/* --- records ---------------------------------------------------------- */}
      <section className="grid gap-4 md:grid-cols-2">
        <RecordCard
          index="02"
          icon={TrendingUp}
          accent={ACCENTS.amber}
          label="Best multiplier"
          value={`${bestMultiplier.toFixed(2)}x`}
          game={bestMultiplierGame}
          image={imageFor(bestMultiplierGame)}
        />
        <RecordCard
          index="03"
          icon={Sparkles}
          accent={ACCENTS.blue}
          label="Best cash win"
          value={money(bestCashWin)}
          game={bestCashWinGame}
          image={imageFor(bestCashWinGame)}
        />
      </section>

      {/* --- the bonuses -------------------------------------------------------- */}
      <section className={sidePanel ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" : "grid gap-4"}>
        <BentoFrame>
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0d10]">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
              <BracketLabel index="04">{tableEyebrow}</BracketLabel>
              <span className="ml-auto truncate text-[12.5px] text-white/40">{tableTitle}</span>
            </header>

            {hunts.length === 0 ? (
              <p className="p-12 text-center text-[13.5px] text-white/35">No bonuses yet. Bonuses will be added shortly.</p>
            ) : (
              <>
                <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_6rem_7rem_5.5rem] gap-4 border-b border-white/[0.05] px-4 py-2.5 sm:grid sm:px-5">
                  {["#", "Slot", "Bet", "Result", "Multi"].map((column, index) => (
                    <BracketLabel key={column} className={`text-white/30 ${index >= 2 ? "justify-end" : ""}`}>
                      {column}
                    </BracketLabel>
                  ))}
                </div>
                <ol>
                  {hunts.map((hunt, index) => (
                    <BonusRow key={hunt.id} hunt={hunt} position={index + 1} next={hunt.id === nextId} />
                  ))}
                </ol>
              </>
            )}
          </div>
        </BentoFrame>
        {sidePanel && <div className="lg:sticky lg:top-20">{sidePanel}</div>}
      </section>
    </div>
  )
}

/**
 * Every bonus as a cell, in list order: lit in its multiplier's colour once
 * opened, an outline pulsing on the one being opened next, dim until then.
 * The hunt read at a glance — how far in, and how well it is going.
 */
function BonusMatrix({ hunts, nextId }: { hunts: HuntBonusRow[]; nextId: string | null }) {
  return (
    <div className="mt-8">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(13px,1fr))] gap-1 sm:max-w-[640px]">
        {hunts.map((hunt, index) => {
          const pending = hunt.result === null
          const multiplier = !pending && hunt.bet_size ? Number(hunt.result) / Number(hunt.bet_size) : 0
          const color = pending ? null : multiplier > 0 ? multiColor(multiplier) : ACCENTS.red
          const next = hunt.id === nextId
          return (
            <span
              key={hunt.id}
              title={`${index + 1}. ${hunt.game_name}${pending ? "" : ` · ${multiplier.toFixed(2)}x`}`}
              className={`lp-cell aspect-square rounded-[3px] ${next ? "lp-cell-now" : ""}`}
              style={{
                animationDelay: `${index * 18}ms`,
                // White at full strength glares next to the others; the
                // ordinary hits sit a step back so the big ones read first.
                backgroundColor: color
                  ? multiplier <= 0
                    ? `${color}40`
                    : color === "#FFFFFF"
                      ? "rgb(255 255 255 / 0.55)"
                      : color
                  : next
                    ? `${ACCENTS.amber}30`
                    : "rgb(255 255 255 / 0.05)",
                border: next ? `1px solid ${ACCENTS.amber}` : "1px solid rgb(255 255 255 / 0.04)",
                boxShadow: color && multiplier >= 100 ? `0 0 8px -1px ${color}` : undefined,
              }}
            />
          )
        })}
      </div>
      <div className="font-geist-mono mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10.5px] uppercase tracking-[0.12em] text-white/35">
        {[
          [ACCENTS.red, "Under 10x"],
          ["rgb(255 255 255 / 0.55)", "10x+"],
          [ACCENTS.green, "100x+"],
          [GOLD, "500x+"],
        ].map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] border" style={{ borderColor: ACCENTS.amber }} />
          Next
        </span>
      </div>
    </div>
  )
}

/** A record as a bento card: the slot's artwork and the figure, then its name. */
function RecordCard({
  index,
  icon: Icon,
  accent,
  label,
  value,
  game,
  image,
}: {
  index: string
  icon: typeof TrendingUp
  accent: string
  label: string
  value: string
  game: string
  image: string | null
}) {
  return (
    <BentoFrame glow={accent}>
      <DotPanel glow={accent} className="p-5">
        <div className="flex items-center gap-5">
          <span className="relative flex aspect-[180/236] w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.10] bg-black/40">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
              <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <Icon className="h-6 w-6" style={{ color: accent }} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[clamp(30px,3.4vw,40px)] font-semibold leading-none tracking-[-0.04em] tabular-nums" style={{ color: accent }}>
              {value}
            </p>
            <p className="mt-2.5 truncate text-[14px] text-white/60">{game || "Waiting for results"}</p>
          </div>
        </div>
      </DotPanel>
      <CardFooter index={index} label={label} />
    </BentoFrame>
  )
}

function BonusRow({ hunt, position, next }: { hunt: HuntBonusRow; position: number; next: boolean }) {
  const multiplier = hunt.result && hunt.bet_size ? Number(hunt.result) / Number(hunt.bet_size) : null
  const pending = hunt.result === null

  return (
    <li
      className={`relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_7rem_5.5rem] sm:px-5 ${
        pending && !next ? "opacity-60" : ""
      }`}
      style={next ? { backgroundColor: `${ACCENTS.amber}0f` } : undefined}
    >
      {next && <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full" style={{ backgroundColor: ACCENTS.amber }} />}

      <span className="font-geist-mono text-[11.5px] tabular-nums text-white/30">{String(position).padStart(2, "0")}</span>

      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/40">
          {hunt.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
            <img src={hunt.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-4 w-4 text-white/20" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {hunt.is_super && <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.amber }} />}
            <span className="truncate text-[14px] font-medium text-white/90">{hunt.game_name}</span>
            {next && (
              <span
                className="font-geist-mono shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.12em]"
                style={{ backgroundColor: `${ACCENTS.amber}24`, color: ACCENTS.amber }}
              >
                Next
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-white/35">
            {hunt.provider || "—"}
            <span className="sm:hidden"> · {money(Number(hunt.bet_size))}</span>
          </span>
        </span>
      </span>

      <span className="hidden text-right text-[13.5px] tabular-nums text-white/55 sm:block">{money(Number(hunt.bet_size))}</span>

      <span
        className="hidden text-right text-[13.5px] font-medium tabular-nums sm:block"
        style={{ color: pending ? "rgba(255,255,255,0.3)" : ACCENTS.green }}
      >
        {pending ? "Pending" : money(Number(hunt.result))}
      </span>

      <span className="text-right">
        <MultiCell multiplier={multiplier} />
        {/* On a phone the result column is hidden, so it rides under the multi. */}
        <span className="block text-[11.5px] tabular-nums sm:hidden" style={{ color: pending ? "rgba(255,255,255,0.3)" : ACCENTS.green }}>
          {pending ? "Pending" : money(Number(hunt.result))}
        </span>
      </span>
    </li>
  )
}

/**
 * The multiplier, coloured by how big the hit is. Every tier is the same size
 * and weight — a hit is read from its colour, so the column never shifts and
 * nothing in the list jumps out by being larger than its neighbours.
 *
 *   under 10x   red      a weak hit
 *   10x–99x     white    an ordinary hit
 *   100x–499x   green    a big one
 *   500x+       gold     the hits people clip
 *
 * The gold is brighter and yellower than the palette amber on purpose: amber
 * already marks the bonus being opened next, and a 500x should not read as
 * "next".
 */
const GOLD = "#F5C542"

export function multiColor(multiplier: number): string {
  if (multiplier >= 500) return GOLD
  if (multiplier >= 100) return ACCENTS.green
  if (multiplier >= 10) return "#FFFFFF"
  return ACCENTS.red
}

function MultiCell({ multiplier }: { multiplier: number | null }) {
  if (!multiplier) return <span className="text-[14px] font-semibold tabular-nums text-white/30">—</span>
  return (
    <span className="text-[14px] font-semibold tabular-nums" style={{ color: multiColor(multiplier) }}>
      {multiplier.toFixed(2)}x
    </span>
  )
}
