"use client"

import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, BarChart3, Target, DollarSign, TrendingUp, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { PageTransition } from "@/components/page-transition"

type PastBonusHunt = {
  id: string
  hunt_id: string
  hunt_name: string
  starting_balance: number
  opening_balance: number
  total_bonuses: number
  total_bet_size: number
  total_result: number
  profit_loss: number
  bonuses: string
  created_at: string
}

type BonusDetail = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
}

export default function PreviousHuntsPage() {
  const [hunts, setHunts] = useState<PastBonusHunt[]>([])
  const [expandedHunts, setExpandedHunts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchPastHunts()
  }, [])

  async function fetchPastHunts() {
    const { data: pastHunts, error } = await supabase
      .from("past_bonushunts")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching past hunts:", error)
      toast({
        title: "Error",
        description: "Failed to fetch past hunts",
        variant: "destructive",
      })
    } else {
      setHunts((pastHunts || []) as PastBonusHunt[])
    }
    setLoading(false)
  }

  function toggleHunt(huntId: string) {
    const newExpanded = new Set(expandedHunts)
    if (newExpanded.has(huntId)) {
      newExpanded.delete(huntId)
    } else {
      newExpanded.add(huntId)
    }
    setExpandedHunts(newExpanded)
  }

  async function handleDeleteHunt(huntId: string) {
    const { error } = await supabase.from("past_bonushunts").delete().eq("id", huntId)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete hunt",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Hunt deleted successfully",
        className: "bg-green-600 text-white",
      })
      await fetchPastHunts()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  const totalHunts = hunts.length
  const profitableHunts = hunts.filter((h) => h.profit_loss > 0).length
  const winRate = totalHunts > 0 ? (profitableHunts / totalHunts) * 100 : 0
  const averageProfit = totalHunts > 0 ? hunts.reduce((sum, h) => sum + h.profit_loss, 0) / totalHunts : 0
  const biggestWin = hunts.length > 0 ? Math.max(...hunts.map((h) => h.profit_loss)) : 0

  let highestWin = { game: "", amount: 0, betSize: 0, provider: null as string | null, huntName: "" }
  let highestMultiplier = { game: "", multiplier: 0, betSize: 0, provider: null as string | null, huntName: "" }

  hunts.forEach((hunt) => {
    try {
      const bonusDetails: BonusDetail[] = JSON.parse(hunt.bonuses)
      bonusDetails.forEach((bonus) => {
        if (bonus.result && bonus.result > highestWin.amount) {
          highestWin = {
            game: bonus.game_name,
            amount: bonus.result,
            betSize: bonus.bet_size,
            provider: bonus.provider,
            huntName: hunt.hunt_name,
          }
        }

        if (bonus.result && bonus.bet_size) {
          const multiplier = bonus.result / bonus.bet_size
          if (multiplier > highestMultiplier.multiplier) {
            highestMultiplier = {
              game: bonus.game_name,
              multiplier: multiplier,
              betSize: bonus.bet_size,
              provider: bonus.provider,
              huntName: hunt.hunt_name,
            }
          }
        }
      })
    } catch (e) {
      console.error("[v0] Error parsing bonuses:", e)
    }
  })

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Previous Hunts</h1>
            <p className="text-base text-slate-400">View your hunt history and statistics</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-700/50 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total Hunts</p>
                    <p className="text-2xl font-bold text-white">{totalHunts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-900/50 rounded-lg">
                    <Target className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-green-400">{winRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-900/50 rounded-lg">
                    <DollarSign className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Avg Profit</p>
                    <p className={`text-2xl font-bold ${averageProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ${Math.abs(averageProfit).toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-900/50 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Biggest Win</p>
                    <p className="text-2xl font-bold text-purple-400">${biggestWin.toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {hunts.length > 0 && (
            <div className="bg-gradient-to-r from-amber-900/20 to-purple-900/20 backdrop-blur border border-amber-700/30 rounded-lg p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-500/20 rounded-lg p-3">
                    <TrendingUp className="w-8 h-8 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-400/70 text-xs uppercase tracking-wider mb-1">Highest Multiplier</p>
                    <p className="text-amber-400 text-sm font-medium truncate">{highestMultiplier.game || "N/A"}</p>
                    <p className="text-amber-300 text-2xl font-bold">
                      {highestMultiplier.multiplier > 0 ? `${highestMultiplier.multiplier.toFixed(2)}x` : "0.00x"}
                      {highestMultiplier.betSize > 0 && (
                        <span className="text-sm ml-2">(${highestMultiplier.betSize.toFixed(2)})</span>
                      )}
                    </p>
                    {highestMultiplier.huntName && (
                      <p className="text-amber-400/50 text-xs mt-1">from {highestMultiplier.huntName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-purple-500/20 rounded-lg p-3">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-purple-400/70 text-xs uppercase tracking-wider mb-1">Highest Win</p>
                    <p className="text-purple-400 text-sm font-medium truncate">{highestWin.game || "N/A"}</p>
                    <p className="text-purple-300 text-2xl font-bold">
                      ${highestWin.amount.toFixed(2)}
                      {highestWin.betSize > 0 && (
                        <span className="text-sm ml-2">({(highestWin.amount / highestWin.betSize).toFixed(0)}x)</span>
                      )}
                    </p>
                    {highestWin.huntName && (
                      <p className="text-purple-400/50 text-xs mt-1">from {highestWin.huntName}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {hunts.length === 0 ? (
            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardContent className="p-12">
                <p className="text-base text-slate-400 text-center">No previous hunts saved yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {hunts.map((hunt) => {
                let bonusDetails: BonusDetail[] = []
                try {
                  bonusDetails = JSON.parse(hunt.bonuses)
                } catch (e) {
                  console.error("[v0] Error parsing bonuses:", e)
                }

                const isExpanded = expandedHunts.has(hunt.id)
                const huntDate = new Date(hunt.created_at)
                const averageBetSize = hunt.total_bonuses > 0 ? hunt.total_bet_size / hunt.total_bonuses : 0

                return (
                  <Card key={hunt.id} className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white text-xl font-bold">{hunt.hunt_name}</h3>
                            <span className="px-3 py-1 bg-cyan-600 text-white text-xs rounded-full font-medium">
                              Completed
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm">
                            {huntDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            -{" "}
                            {huntDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center px-6 py-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Start</p>
                            <p className="text-white text-lg font-bold">${hunt.starting_balance.toFixed(0)}</p>
                          </div>

                          <div className="text-center px-6 py-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">End</p>
                            <p className="text-white text-lg font-bold">${hunt.total_result.toFixed(0)}</p>
                          </div>

                          <div className="text-center px-6 py-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">P/L</p>
                            <p
                              className={`text-lg font-bold ${hunt.profit_loss >= 0 ? "text-green-400" : "text-red-400"}`}
                            >
                              {hunt.profit_loss >= 0 ? "+" : ""}${hunt.profit_loss.toFixed(0)}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleHunt(hunt.id)}
                            className="text-slate-400 hover:text-white hover:bg-slate-700 h-10 w-10 p-0"
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-6 pt-6 border-t border-slate-700">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                            <div>
                              <p className="text-slate-400 text-xs mb-1">Total Bonuses</p>
                              <p className="text-white text-lg font-semibold">{hunt.total_bonuses}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-xs mb-1">Average Betsize</p>
                              <p className="text-white text-lg font-semibold">${averageBetSize.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-xs mb-1">Total Result</p>
                              <p className="text-white text-lg font-semibold">${hunt.total_result.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-xs mb-1">Opening Balance</p>
                              <p className="text-white text-lg font-semibold">${hunt.opening_balance.toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-white text-base font-medium mb-3">Bonuses</h4>
                            {bonusDetails.map((bonus, index) => {
                              const multiplier = bonus.result && bonus.bet_size ? bonus.result / bonus.bet_size : 0

                              return (
                                <div
                                  key={index}
                                  className="bg-slate-800/50 p-4 rounded-lg grid grid-cols-[1fr_auto] gap-4 items-center"
                                >
                                  <div>
                                    <p className="text-white text-base font-medium">{bonus.game_name}</p>
                                    {bonus.provider && <p className="text-slate-400 text-sm">{bonus.provider}</p>}
                                  </div>
                                  <div className="grid grid-cols-3 gap-6 text-sm">
                                    <div className="text-center w-20">
                                      <p className="text-slate-400 text-xs mb-1">Bet</p>
                                      <p className="text-red-400 font-medium text-base">
                                        ${Number(bonus.bet_size).toFixed(2)}
                                      </p>
                                    </div>
                                    <div className="text-center w-20">
                                      <p className="text-slate-400 text-xs mb-1">Result</p>
                                      <p className="text-green-400 font-medium text-base">
                                        {bonus.result !== null ? `$${Number(bonus.result).toFixed(2)}` : "-"}
                                      </p>
                                    </div>
                                    <div className="text-center w-24">
                                      <p className="text-slate-400 text-xs mb-1">Multi</p>
                                      <p className="text-amber-400 font-medium text-base">
                                        {bonus.result !== null ? `${multiplier.toFixed(2)}x` : "-"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
