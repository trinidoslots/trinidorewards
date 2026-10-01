import type { ReactNode } from "react"
import { Crown, ImageIcon, Sparkles, TrendingUp } from "lucide-react"
import type { HuntKpis } from "@/lib/active-hunt"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

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
      {/* --- scoreboard ------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: ACCENTS.amber }}
        />
        <div className="relative flex flex-wrap items-center gap-x-10 gap-y-7 p-6 sm:p-8">
          <ProgressRing percent={percent} opened={opened} total={total} />

          <div className="min-w-[15rem] flex-1">
            <MonoLabel className="text-white/40">Total won</MonoLabel>
            <p className="mt-2 text-[clamp(38px,5vw,60px)] font-black leading-none tabular-nums tracking-[-0.02em] text-white">
              {money(totalWonVal)}
            </p>
            <p className="mt-3 text-[14px] text-white/45">
              <span
                className="font-semibold tabular-nums"
                style={{ color: profitLoss >= 0 ? ACCENTS.green : ACCENTS.red }}
              >
                {profitLoss >= 0 ? "+" : "−"}
                {money(Math.abs(profitLoss))}
              </span>{" "}
              against a {money(startingBalanceVal)} start
            </p>
          </div>

          {/* The one number a live hunt is watched for. */}
          <div className="min-w-[13rem] rounded-lg border px-5 py-4" style={{ borderColor: `${ACCENTS.amber}44`, backgroundColor: `${ACCENTS.amber}0f` }}>
            <MonoLabel style={{ color: ACCENTS.amber }}>{done ? "Hunt complete" : "Break even"}</MonoLabel>
            {/* Finished, break-even means nothing; what came back does. The
                average multi is already in the strip below. */}
            <p className="mt-2 text-[34px] font-black leading-none tabular-nums" style={{ color: ACCENTS.amber }}>
              {done
                ? `${startingBalanceVal > 0 ? Math.round((totalWonVal / startingBalanceVal) * 100) : 0}%`
                : `${breakEven.toFixed(2)}x`}
            </p>
            <p className="mt-2 text-[12.5px] text-white/45">
              {done ? "of the starting balance returned" : `average needed on the ${remainingCount} still to open`}
            </p>
          </div>
        </div>

        <dl className="relative grid grid-cols-2 border-t border-white/[0.07] sm:grid-cols-4">
          {[
            ["Starting balance", money(startingBalanceVal)],
            ["Average multi", `${averageMultiplier.toFixed(2)}x`],
            ["Average bet", money(averageBet)],
            ["Remaining", `${remainingCount}`],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`px-6 py-4 sm:px-8 ${index % 2 === 1 ? "border-l border-white/[0.07]" : ""} ${
                index >= 2 ? "border-t border-white/[0.07] sm:border-t-0" : ""
              } ${index === 2 ? "sm:border-l" : ""}`}
            >
              <dt>
                <MonoLabel className="text-white/35">{label}</MonoLabel>
              </dt>
              <dd className="mt-1.5 text-[20px] font-bold tabular-nums text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --- records ---------------------------------------------------------- */}
      <section className="grid gap-4 md:grid-cols-2">
        <RecordCard
          icon={TrendingUp}
          accent={ACCENTS.amber}
          label="Best multiplier"
          value={`${bestMultiplier.toFixed(2)}x`}
          game={bestMultiplierGame}
          image={imageFor(bestMultiplierGame)}
        />
        <RecordCard
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
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12]">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENTS.amber }} />
            <MonoLabel className="text-white/70">{tableEyebrow}</MonoLabel>
            <span className="ml-auto truncate text-[12.5px] text-white/40">{tableTitle}</span>
          </header>

          {hunts.length === 0 ? (
            <p className="p-12 text-center text-[13px] text-white/35">No bonuses yet. Bonuses will be added shortly.</p>
          ) : (
            <>
              <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_6rem_7rem_5.5rem] gap-4 border-b border-white/[0.05] px-5 py-2.5 sm:grid sm:px-6">
                {["#", "Slot", "Bet", "Result", "Multi"].map((column, index) => (
                  <MonoLabel key={column} className={`text-white/30 ${index >= 2 ? "text-right" : ""}`}>
                    {column}
                  </MonoLabel>
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
        {sidePanel && <div className="h-[800px] lg:sticky lg:top-20">{sidePanel}</div>}
      </section>
    </div>
  )
}

/** How many of the bonuses are open, as a ring with the count inside. */
function ProgressRing({ percent, opened, total }: { percent: number; opened: number; total: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative h-[136px] w-[136px] shrink-0">
      <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="68" cy="68" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle
          cx="68"
          cy="68"
          r={radius}
          fill="none"
          stroke={ACCENTS.amber}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-black leading-none tabular-nums text-white">
          {opened}
          <span className="text-[16px] text-white/35">/{total}</span>
        </span>
        <MonoLabel className="mt-1.5 text-white/40">opened</MonoLabel>
      </div>
    </div>
  )
}

function RecordCard({
  icon: Icon,
  accent,
  label,
  value,
  game,
  image,
}: {
  icon: typeof TrendingUp
  accent: string
  label: string
  value: string
  game: string
  image: string | null
}) {
  return (
    <div className="relative flex items-center gap-5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12] p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: accent }}
      />
      <span className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.10] bg-black/40">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-6 w-6" style={{ color: accent }} />
        )}
      </span>
      <div className="relative min-w-0">
        <MonoLabel style={{ color: accent }}>{label}</MonoLabel>
        <p className="mt-2 text-[30px] font-black leading-none tabular-nums" style={{ color: accent }}>
          {value}
        </p>
        <p className="mt-2 truncate text-[13.5px] text-white/55">{game || "Waiting for results"}</p>
      </div>
    </div>
  )
}

function BonusRow({ hunt, position, next }: { hunt: HuntBonusRow; position: number; next: boolean }) {
  const multiplier = hunt.result && hunt.bet_size ? Number(hunt.result) / Number(hunt.bet_size) : null
  const pending = hunt.result === null

  return (
    <li
      className={`relative grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-white/[0.05] px-5 py-3 transition-colors last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_7rem_5.5rem] sm:px-6 ${
        pending && !next ? "opacity-60" : ""
      }`}
      style={next ? { backgroundColor: `${ACCENTS.amber}0d` } : undefined}
    >
      {next && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: ACCENTS.amber }} />}

      <span className="font-mono text-[12px] tabular-nums text-white/30">{String(position).padStart(2, "0")}</span>

      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-black/40">
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
            <span className="truncate text-[14px] font-semibold text-white/90">{hunt.game_name}</span>
            {next && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-black"
                style={{ backgroundColor: ACCENTS.amber }}
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
  if (!multiplier) return <span className="text-[14px] font-bold tabular-nums text-white/30">—</span>
  return (
    <span className="text-[14px] font-bold tabular-nums" style={{ color: multiColor(multiplier) }}>
      {multiplier.toFixed(2)}x
    </span>
  )
}
