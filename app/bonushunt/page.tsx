import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Sparkles } from "lucide-react"
import { PageTransition } from "@/components/page-transition"

type BonusHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
}

export default async function BonusHuntPage() {
  const supabase = await createClient()

  const { data: bonusHunts, error } = await supabase
    .from("bonus_hunts")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching bonus hunts:", error)
  }

  const allHunts = (bonusHunts || []) as BonusHunt[]

  const tempBalanceHolder = allHunts.find((hunt) => hunt.game_name === "_temp_balance_holder")
  const hunts = allHunts.filter((hunt) => hunt.game_name !== "_temp_balance_holder")

  const totalBetSize = hunts.reduce((sum, hunt) => sum + Number(hunt.bet_size), 0)
  const totalWinsSoFar = hunts.reduce((sum, hunt) => sum + (Number(hunt.result) || 0), 0)

  const startingBalance = tempBalanceHolder?.starting_balance
    ? Number(tempBalanceHolder.starting_balance)
    : hunts.length > 0 && hunts[0].starting_balance
      ? Number(hunts[0].starting_balance)
      : 0
  const openingBalance = tempBalanceHolder?.opening_balance
    ? Number(tempBalanceHolder.opening_balance)
    : hunts.length > 0 && hunts[0].opening_balance
      ? Number(hunts[0].opening_balance)
      : 0

  const remainingBonuses = hunts.filter((hunt) => hunt.result === null || hunt.result === 0)
  const remainingStakes = remainingBonuses.map((hunt) => Number(hunt.bet_size))
  const totalRemainingStakes = remainingStakes.reduce((sum, stake) => sum + stake, 0)

  let breakEvenX = 0
  if (totalRemainingStakes > 0) {
    const missing = startingBalance - totalWinsSoFar
    breakEvenX = missing / totalRemainingStakes
    breakEvenX = Math.max(0, breakEvenX)
  }

  const completedHunts = hunts.filter((hunt) => hunt.result !== null && hunt.result > 0)
  const totalBonuses = hunts.length
  const unopenedCount = remainingBonuses.length

  const averageBet = totalBonuses > 0 ? totalBetSize / totalBonuses : 0

  const totalMultiplier = completedHunts.reduce((sum, hunt) => {
    if (hunt.result && hunt.bet_size) {
      return sum + Number(hunt.result) / Number(hunt.bet_size)
    }
    return sum
  }, 0)
  const averageMultiplier = completedHunts.length > 0 ? totalMultiplier / completedHunts.length : 0

  const winRate = completedHunts.length > 0 ? averageMultiplier : 0

  const highestMultiplierData = completedHunts.reduce(
    (max, hunt) => {
      if (hunt.result && hunt.bet_size) {
        const multiplier = Number(hunt.result) / Number(hunt.bet_size)
        if (multiplier > max.multiplier) {
          return {
            multiplier: multiplier,
            game: hunt.game_name,
            provider: hunt.provider,
            betsize: hunt.bet_size,
          }
        }
      }
      return max
    },
    { multiplier: 0, game: "", provider: null as string | null, betsize: 0 },
  )

  const highestWin = completedHunts.reduce(
    (max, hunt) => {
      if (hunt.result && Number(hunt.result) > max.amount) {
        return {
          game: hunt.game_name,
          amount: Number(hunt.result),
          betSize: Number(hunt.bet_size),
          provider: hunt.provider,
        }
      }
      return max
    },
    { game: "", amount: 0, betSize: 0, provider: null as string | null },
  )

  const highestWinMultiplier = highestWin.betSize > 0 ? highestWin.amount / highestWin.betSize : 0

  const profitLoss = totalWinsSoFar - startingBalance

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-3">
            <h1 className="text-xl font-bold text-white">Bonus Hunt Tracker</h1>
            <p className="text-slate-400 text-xs">Track your casino bonus hunts in real-time</p>
          </div>

          <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div className="text-center">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Start</p>
                <p className="text-white text-base font-bold">${startingBalance.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <p className="text-cyan-500 text-[10px] uppercase tracking-wider mb-0.5">Win</p>
                <p className="text-cyan-400 text-base font-bold">${totalWinsSoFar.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">P/L</p>
                <p className={`text-base font-bold ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {profitLoss >= 0 ? "+" : ""}${profitLoss.toFixed(0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Bonuses</p>
                <p className="text-white text-base font-bold">
                  {completedHunts.length}
                  <span className="text-slate-600 text-xs">/{totalBonuses}</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Win Rate</p>
                <p className="text-white text-base font-bold">{winRate.toFixed(1)}x</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Break Even</p>
                <p className="text-white text-base font-bold">{breakEvenX > 0 ? breakEvenX.toFixed(1) : "0.0"}x</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-900/20 to-purple-900/20 backdrop-blur border border-amber-700/30 rounded-lg p-2.5 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/20 rounded p-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400/70 text-[10px] uppercase tracking-wider">Highest Multi</p>
                  <p className="text-amber-400 text-xs font-medium truncate">{highestMultiplierData.game || "N/A"}</p>
                  <p className="text-amber-300 text-sm font-bold">
                    {highestMultiplierData.multiplier.toFixed(2)}x
                    {highestMultiplierData.betsize > 0 && (
                      <span className="text-xs ml-1">(${highestMultiplierData.betsize.toFixed(2)})</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-purple-500/20 rounded p-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-purple-400/70 text-[10px] uppercase tracking-wider">Highest Win</p>
                  <p className="text-purple-400 text-xs font-medium truncate">{highestWin.game || "N/A"}</p>
                  <p className="text-purple-300 text-sm font-bold">
                    ${highestWin.amount.toFixed(2)}
                    {highestWinMultiplier > 0 && (
                      <span className="text-xs ml-1">({highestWinMultiplier.toFixed(0)}x)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
            <CardContent className="p-3">
              <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-cyan-500 rounded"></div>
                CURRENT BONUS HUNT
              </h2>
              {hunts.length === 0 ? (
                <p className="text-slate-400 text-center py-6 text-xs">
                  No bonuses yet. Bonuses will be added shortly!
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                          Game
                        </th>
                        <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                          Provider
                        </th>
                        <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                          Bet Size
                        </th>
                        <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                          Result
                        </th>
                        <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                          Multiplier
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hunts.map((hunt) => {
                        const multiplier =
                          hunt.result && hunt.bet_size ? (Number(hunt.result) / Number(hunt.bet_size)).toFixed(2) : null

                        return (
                          <tr key={hunt.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                            <td className="py-1.5 px-2 text-white text-xs">{hunt.game_name}</td>
                            <td className="py-1.5 px-2 text-slate-400 text-[10px]">{hunt.provider || "-"}</td>
                            <td className="py-1.5 px-2 text-red-400 text-xs">${Number(hunt.bet_size).toFixed(2)}</td>
                            <td className="py-1.5 px-2 text-green-400 text-xs">
                              {hunt.result !== null ? `$${Number(hunt.result).toFixed(2)}` : "-"}
                            </td>
                            <td className="py-1.5 px-2 text-amber-400 text-xs">
                              {multiplier ? `${multiplier}x` : "-"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  )
}
