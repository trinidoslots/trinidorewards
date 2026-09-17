import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target, TrendingUp, Clock, CheckCircle2 } from "lucide-react"
import { HuntActions } from "@/components/hunt-actions"
import { NewHuntDialog } from "@/components/new-hunt-dialog"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

type Hunt = {
  id: string
  user_id: string
  casino: string
  slot: string
  start_balance: number
  target_balance: number
  current_balance: number
  status: string
  start_time: string
  end_time: string | null
  max_bet: number
  bonus_hit: boolean
  bonus_details: string | null
  created_at: string
  updated_at: string
}

export default async function HuntsPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const username = cookieStore.get("kick_username")?.value

  if (!username) {
    redirect("/")
  }

  // Fetch user's hunts
  const { data: hunts, error } = await supabase.from("hunts").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching hunts:", error)
  }

  const allHunts = (hunts || []) as Hunt[]
  const activeHunts = allHunts.filter((h) => h.status === "active")
  const completedHunts = allHunts.filter((h) => h.status === "completed")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Bonus Hunts</h1>
            <p className="text-slate-400 text-sm">Track your casino bonus hunt progress</p>
          </div>
          <NewHuntDialog />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 rounded-lg p-2">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Active Hunts</p>
                  <p className="text-white text-2xl font-bold">{activeHunts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-500/20 rounded-lg p-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Completed</p>
                  <p className="text-white text-2xl font-bold">{completedHunts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/20 rounded-lg p-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Total Profit</p>
                  <p className="text-white text-2xl font-bold">
                    ${completedHunts.reduce((sum, h) => sum + (h.current_balance - h.start_balance), 0).toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/20 rounded-lg p-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Bonus Hits</p>
                  <p className="text-white text-2xl font-bold">{allHunts.filter((h) => h.bonus_hit).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Hunts */}
        {activeHunts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-cyan-500 rounded"></div>
              Active Hunts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeHunts.map((hunt) => {
                const progress =
                  ((hunt.current_balance - hunt.start_balance) / (hunt.target_balance - hunt.start_balance)) * 100
                const profitLoss = hunt.current_balance - hunt.start_balance

                return (
                  <Card key={hunt.id} className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-white text-lg">{hunt.slot}</CardTitle>
                          <p className="text-slate-400 text-sm">{hunt.casino}</p>
                        </div>
                        <Badge
                          variant={hunt.bonus_hit ? "default" : "secondary"}
                          className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                        >
                          {hunt.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Progress to Target</span>
                          <span className="text-white font-medium">{Math.min(progress, 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              progress >= 100 ? "bg-green-500" : "bg-cyan-500"
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Balance Info */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-slate-400 text-xs">Start</p>
                          <p className="text-white text-sm font-bold">${hunt.start_balance.toFixed(0)}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-slate-400 text-xs">Current</p>
                          <p className="text-cyan-400 text-sm font-bold">${hunt.current_balance.toFixed(0)}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-slate-400 text-xs">Target</p>
                          <p className="text-green-400 text-sm font-bold">${hunt.target_balance.toFixed(0)}</p>
                        </div>
                      </div>

                      {/* P/L and Max Bet */}
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="text-slate-400">P/L: </span>
                          <span className={`font-bold ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {profitLoss >= 0 ? "+" : ""}${profitLoss.toFixed(0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Max Bet: </span>
                          <span className="text-white font-bold">${hunt.max_bet.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Bonus Hit Badge */}
                      {hunt.bonus_hit && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                          <p className="text-amber-400 text-xs font-semibold mb-1">🎰 Bonus Hit!</p>
                          {hunt.bonus_details && <p className="text-slate-300 text-xs">{hunt.bonus_details}</p>}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <HuntActions huntId={hunt.id} currentBalance={hunt.current_balance} bonusHit={hunt.bonus_hit} />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Completed Hunts */}
        {completedHunts.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-green-500 rounded"></div>
              Completed Hunts
            </h2>
            <div className="space-y-3">
              {completedHunts.map((hunt) => {
                const profitLoss = hunt.current_balance - hunt.start_balance
                const isProfit = profitLoss >= 0

                return (
                  <Card key={hunt.id} className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-bold">{hunt.slot}</h3>
                            <span className="text-slate-400 text-sm">{hunt.casino}</span>
                            {hunt.bonus_hit && (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs"
                              >
                                Bonus Hit
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-400">
                              ${hunt.start_balance.toFixed(0)} → ${hunt.current_balance.toFixed(0)}
                            </span>
                            <span className={`font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
                              {isProfit ? "+" : ""}${profitLoss.toFixed(0)}
                            </span>
                            {hunt.end_time && (
                              <span className="text-slate-500 text-xs">
                                {new Date(hunt.end_time).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                          Completed
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {allHunts.length === 0 && (
          <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
            <CardContent className="p-12 text-center">
              <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-white text-xl font-bold mb-2">No Hunts Yet</h3>
              <p className="text-slate-400 mb-6">Start tracking your bonus hunts by creating your first hunt!</p>
              <NewHuntDialog />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
