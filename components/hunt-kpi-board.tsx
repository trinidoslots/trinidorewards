import type { ReactNode } from "react"
import { Crown, ImageIcon, Sparkles, TrendingUp, Zap } from "lucide-react"
import type { HuntKpis } from "@/lib/active-hunt"

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

const money = (value: number) => `$${value.toFixed(2)}`

/**
 * Shared presentational KPI-card/table block used by both the live Bonus Hunt
 * page and the Past Hunts page, so they always render an identical layout off
 * the same `bonus_hunt_kpis` + `hunt_bonuses` data shape.
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
  const openingBalance = 0
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

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Starting balance", money(startingBalanceVal), "text-white"],
          ["Opening balance", money(openingBalance), "text-cyan-200"],
          ["Total won", money(totalWonVal), "text-cyan-200"],
          ["P / L", `${profitLoss >= 0 ? "+" : "-"}${money(Math.abs(profitLoss))}`, profitLoss >= 0 ? "text-emerald-300" : "text-rose-300"],
          ["Average multi", `${averageMultiplier.toFixed(2)}x`, "text-white"],
          ["Break even", `${breakEven.toFixed(2)}x`, "text-amber-200"],
          ["Average bet", money(averageBet), "text-white"],
          ["Remaining", `${remainingCount}`, "text-cyan-200"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/25">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-amber-200/15 bg-amber-200/[0.06] p-5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><TrendingUp /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Best multiplier</p>
            <p className="truncate text-lg font-bold text-white">{bestMultiplierGame || "Waiting for results"}</p>
            <p className="text-2xl font-bold text-amber-200">{bestMultiplier.toFixed(2)}x</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] p-5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><Sparkles /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Best cash win</p>
            <p className="truncate text-lg font-bold text-white">{bestCashWinGame || "Waiting for results"}</p>
            <p className="text-2xl font-bold text-cyan-200">{money(bestCashWin)}</p>
          </div>
        </div>
      </section>

      <section className={sidePanel ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" : "grid gap-6"}>
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{tableEyebrow}</p>
              <h3 className="mt-1 text-xl font-bold text-white">{tableTitle}</h3>
            </div>
            <Zap className="text-cyan-300" />
          </div>
          {hunts.length === 0 ? (
            <p className="p-10 text-center text-slate-400">No bonuses yet. Bonuses will be added shortly.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[620px]">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
                  <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4">Game</th>
                    <th>Provider</th>
                    <th>Bet</th>
                    <th>Result</th>
                    <th>Multi</th>
                  </tr>
                </thead>
                <tbody>
                  {hunts.map((hunt) => {
                    const multiplier = hunt.result && hunt.bet_size ? Number(hunt.result) / Number(hunt.bet_size) : null
                    return (
                      <tr key={hunt.id} className="border-b border-slate-800/70 text-sm transition hover:bg-cyan-200/[0.04]">
                        <td className="px-5 py-4 font-semibold text-white">
                          <span className="flex items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                              {hunt.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                                <img
                                  src={hunt.image_url || "/placeholder.svg"}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="size-3.5 text-slate-600" />
                              )}
                            </span>
                            {hunt.is_super && <Crown className="size-4 shrink-0 text-amber-300" />}
                            <span className="truncate">{hunt.game_name}</span>
                          </span>
                        </td>
                        <td className="text-slate-400">{hunt.provider || "-"}</td>
                        <td className="font-medium text-rose-300">{money(Number(hunt.bet_size))}</td>
                        <td className="font-medium text-emerald-300">{hunt.result !== null ? money(Number(hunt.result)) : "Pending"}</td>
                        <td className="font-semibold text-amber-200">{multiplier ? `${multiplier.toFixed(2)}x` : "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="h-[800px]">{sidePanel}</div>
      </section>
    </div>
  )
}
