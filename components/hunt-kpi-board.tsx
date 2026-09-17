import type { ReactNode } from "react"
import { Crown, ImageIcon, Sparkles, TrendingUp } from "lucide-react"
import type { HuntKpis } from "@/lib/active-hunt"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"

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

  const figures: [string, string, string | undefined][] = [
    ["Starting balance", money(startingBalanceVal), undefined],
    ["Opening balance", money(openingBalance), undefined],
    ["Total won", money(totalWonVal), ACCENTS.blue],
    [
      "P / L",
      `${profitLoss >= 0 ? "+" : "−"}${money(Math.abs(profitLoss))}`,
      profitLoss >= 0 ? ACCENTS.green : ACCENTS.red,
    ],
    ["Average multi", `${averageMultiplier.toFixed(2)}x`, undefined],
    ["Break even", `${breakEven.toFixed(2)}x`, ACCENTS.amber],
    ["Average bet", money(averageBet), undefined],
    ["Remaining", `${remainingCount}`, ACCENTS.purple],
  ]

  return (
    <div className="flex flex-col gap-2.5">
      {/* Figures lead the page — the numbers are what people come for */}
      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {figures.map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.022] px-4 py-3.5">
            <p
              className="text-[22px] font-semibold leading-none tabular-nums tracking-tight"
              style={{ color: color ?? "#E7E7EA" }}
            >
              {value}
            </p>
            <MonoLabel className="mt-2 block text-white/35">{label}</MonoLabel>
          </div>
        ))}
      </section>

      {/* The two records worth calling out */}
      <section className="grid gap-2.5 md:grid-cols-2">
        <Panel accent="amber" className="flex items-center gap-3.5 p-4">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ color: ACCENTS.amber, backgroundColor: `${ACCENTS.amber}1a` }}
          >
            <TrendingUp className="size-4" />
          </span>
          <div className="min-w-0">
            <MonoLabel className="text-white/35">Best multiplier</MonoLabel>
            <p className="mt-1 truncate text-[13px] text-white/70">{bestMultiplierGame || "Waiting for results"}</p>
            <p className="text-[20px] font-semibold tabular-nums" style={{ color: ACCENTS.amber }}>
              {bestMultiplier.toFixed(2)}x
            </p>
          </div>
        </Panel>

        <Panel accent="blue" className="flex items-center gap-3.5 p-4">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ color: ACCENTS.blue, backgroundColor: `${ACCENTS.blue}1a` }}
          >
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <MonoLabel className="text-white/35">Best cash win</MonoLabel>
            <p className="mt-1 truncate text-[13px] text-white/70">{bestCashWinGame || "Waiting for results"}</p>
            <p className="text-[20px] font-semibold tabular-nums" style={{ color: ACCENTS.blue }}>
              {money(bestCashWin)}
            </p>
          </div>
        </Panel>
      </section>

      <section
        className={sidePanel ? "grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" : "grid gap-2.5"}
      >
        <Panel className="flex flex-col overflow-hidden">
          <PanelHeader title={tableEyebrow} right={<MonoLabel className="text-white/30">{tableTitle}</MonoLabel>} />

          {hunts.length === 0 ? (
            <p className="p-10 text-center text-[12.5px] text-white/30">
              No bonuses yet. Bonuses will be added shortly.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[620px] border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0E0E11]">
                  <tr className="border-b border-white/[0.08] text-left">
                    {["Game", "Provider", "Bet", "Result", "Multi"].map((column) => (
                      <th key={column} className="px-4 py-2.5 font-normal">
                        <MonoLabel className="text-white/30">{column}</MonoLabel>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hunts.map((hunt) => {
                    const multiplier = hunt.result && hunt.bet_size ? Number(hunt.result) / Number(hunt.bet_size) : null
                    const pending = hunt.result === null
                    return (
                      <tr
                        key={hunt.id}
                        className="border-b border-white/[0.05] text-[13px] transition hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-2.5 text-white/85">
                          <span className="flex items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-black/40">
                              {hunt.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                                <img
                                  src={hunt.image_url || "/placeholder.svg"}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="size-3 text-white/20" />
                              )}
                            </span>
                            {hunt.is_super && <Crown className="size-3.5 shrink-0" style={{ color: ACCENTS.amber }} />}
                            <span className="truncate">{hunt.game_name}</span>
                          </span>
                        </td>
                        <td className="text-white/35">{hunt.provider || "—"}</td>
                        <td className="tabular-nums" style={{ color: ACCENTS.red }}>
                          {money(Number(hunt.bet_size))}
                        </td>
                        <td className="tabular-nums" style={{ color: pending ? "rgba(255,255,255,0.25)" : ACCENTS.green }}>
                          {pending ? "Pending" : money(Number(hunt.result))}
                        </td>
                        <td className="font-semibold tabular-nums" style={{ color: ACCENTS.amber }}>
                          {multiplier ? `${multiplier.toFixed(2)}x` : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {sidePanel && <div className="h-[800px]">{sidePanel}</div>}
      </section>
    </div>
  )
}
