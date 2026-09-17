"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { HuntKpis } from "@/lib/active-hunt"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Edit2, Save, X, ChevronDown, ChevronUp, History, Crown, ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type BonusDetail = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  is_super: boolean
  image_url?: string | null
}

export default function AdminHistoryPage() {
  const [pastHunts, setPastHunts] = useState<HuntKpis[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedHunt, setExpandedHunt] = useState<string | null>(null)
  const [expandedBonuses, setExpandedBonuses] = useState<BonusDetail[]>([])
  const [editingHunt, setEditingHunt] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ streamer: "", title: "", starting_balance: "" })
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    fetchPastHunts()
  }, [])

  async function fetchPastHunts() {
    const { data, error } = await supabase
      .from("bonus_hunt_kpis")
      .select("*")
      .eq("status", "ended")
      .order("ended_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching past hunts:", error)
      toast({
        title: "Error",
        description: "Failed to fetch past hunts",
        variant: "destructive",
      })
    } else {
      setPastHunts((data || []) as HuntKpis[])
    }
    setLoading(false)
  }

  async function handleDelete(huntId: string) {
    if (!confirm("Permanently delete this hunt and all of its bonuses? This action cannot be undone.")) {
      return
    }

    const { error } = await supabase.from("bonus_hunts").delete().eq("id", huntId)

    if (error) {
      console.error("[v0] Error deleting hunt:", error)
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
      if (expandedHunt === huntId) setExpandedHunt(null)
      setPastHunts((prev) => prev.filter((h) => h.hunt_id !== huntId))
    }
  }

  async function toggleHuntExpansion(huntId: string) {
    if (expandedHunt === huntId) {
      setExpandedHunt(null)
      return
    }
    setExpandedHunt(huntId)
    const { data, error } = await supabase
      .from("hunt_bonuses")
      .select("id, game_name, provider, bet_size, result, is_super, image_url, position")
      .eq("hunt_id", huntId)
      .order("position", { ascending: true })
    if (error) {
      console.error("[v0] Error fetching hunt bonuses:", error)
      setExpandedBonuses([])
    } else {
      setExpandedBonuses((data || []) as BonusDetail[])
    }
  }

  function startEditing(hunt: HuntKpis) {
    setEditingHunt(hunt.hunt_id)
    setEditForm({
      streamer: hunt.streamer,
      title: hunt.title ?? "",
      starting_balance: hunt.starting_balance.toString(),
    })
  }

  async function saveEdit(huntId: string) {
    const updates = {
      streamer: editForm.streamer.trim(),
      title: editForm.title.trim() || null,
      starting_balance: Number.parseFloat(editForm.starting_balance),
    }

    const { error } = await supabase.from("bonus_hunts").update(updates).eq("id", huntId)

    if (error) {
      console.error("[v0] Error updating hunt:", error)
      toast({
        title: "Error",
        description: "Failed to update hunt",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Hunt updated successfully",
        className: "bg-green-600 text-white",
      })
      setEditingHunt(null)
      fetchPastHunts()
    }
  }

  function cancelEdit() {
    setEditingHunt(null)
    setEditForm({ streamer: "", title: "", starting_balance: "" })
  }

  if (loading) {
    return <p className="text-white/40 text-xs">Loading hunt history…</p>
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Hunt History</h1>
        <p className="text-xs text-white/40">View, edit, and permanently delete past bonus hunts</p>
      </div>

      <Card className="bg-white/[0.022] backdrop-blur border-white/[0.08]">
        <CardHeader className="p-3">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <History className="w-4 h-4" />
            Past Hunts ({pastHunts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {pastHunts.length === 0 ? (
            <p className="text-white/40 text-center py-6 text-xs">No past hunts yet</p>
          ) : (
            <div className="space-y-2">
              {pastHunts.map((hunt) => {
                const isExpanded = expandedHunt === hunt.hunt_id
                const startingBalance = Number(hunt.starting_balance)
                const totalWon = Number(hunt.total_won)
                const profitLoss = totalWon - startingBalance
                const totalBet = Number(hunt.average_bet) * hunt.total_bonuses

                return (
                  <div
                    key={hunt.hunt_id}
                    className="bg-white/[0.04] rounded-lg border border-white/[0.10] hover:border-[#5B8DEF]/50 transition-colors overflow-hidden"
                  >
                    <div className="p-3">
                      {editingHunt === hunt.hunt_id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-white/60 text-xs">Streamer</Label>
                              <Input
                                value={editForm.streamer}
                                onChange={(e) => setEditForm({ ...editForm, streamer: e.target.value })}
                                className="bg-[#101014] border-white/[0.10] text-white mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-white/60 text-xs">Title</Label>
                              <Input
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                className="bg-[#101014] border-white/[0.10] text-white mt-1 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-white/60 text-xs">Starting Balance</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.starting_balance}
                              onChange={(e) => setEditForm({ ...editForm, starting_balance: e.target.value })}
                              className="bg-[#101014] border-white/[0.10] text-white mt-1 h-8 text-xs"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEdit(hunt.hunt_id)}
                              className="flex-1 bg-[#5B8DEF] hover:bg-[#4A7AD8] h-7 text-xs"
                            >
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              className="flex-1 bg-transparent border-white/[0.12] text-white/60 hover:text-white h-7 text-xs"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-white font-semibold text-sm">
                                  {hunt.streamer}
                                  {hunt.title ? <span className="text-white/40"> · {hunt.title}</span> : null}
                                </h3>
                                <span className="text-white/40 text-[10px]">
                                  {new Date(hunt.ended_at ?? hunt.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(hunt)}
                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-950/50 h-7 w-7 p-0"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(hunt.hunt_id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-950/50 h-7 w-7 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleHuntExpansion(hunt.hunt_id)}
                                className="text-[#5B8DEF] hover:text-[#5B8DEF] hover:bg-[#0B0B0D]/50 h-7 w-7 p-0"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <p className="text-white/40">Bonuses</p>
                              <p className="text-white font-medium">{hunt.total_bonuses}</p>
                            </div>
                            <div>
                              <p className="text-white/40">Total Bet</p>
                              <p className="text-red-400 font-medium">${totalBet.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-white/40">Total Won</p>
                              <p className="text-green-400 font-medium">${totalWon.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-white/40">P/L</p>
                              <p className={`font-medium ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {profitLoss >= 0 ? "+" : ""}${profitLoss.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/[0.10] bg-[#101014]/30 p-3">
                        <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                          <div>
                            <p className="text-white/40">Starting Balance</p>
                            <p className="text-white font-medium">${startingBalance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-white/40">Best Multiplier</p>
                            <p className="text-amber-400 font-medium">{Number(hunt.best_multiplier).toFixed(2)}x</p>
                          </div>
                          <div>
                            <p className="text-white/40">Best Cash Win</p>
                            <p className="text-green-400 font-medium">${Number(hunt.best_cash_win).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-white/40">Average Multi</p>
                            <p className="text-amber-400 font-medium">{Number(hunt.average_multi).toFixed(2)}x</p>
                          </div>
                        </div>

                        <h4 className="text-white font-medium mb-2 text-xs">Bonuses ({expandedBonuses.length})</h4>
                        <div className="space-y-1 max-h-[400px] overflow-y-auto">
                          {expandedBonuses.map((bonus) => {
                            const multiplier =
                              bonus.result && bonus.bet_size ? (bonus.result / bonus.bet_size).toFixed(2) : "0.00"
                            const profit = (bonus.result || 0) - bonus.bet_size

                            return (
                              <div key={bonus.id} className="bg-white/[0.04] p-2 rounded border border-white/[0.10]">
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.10] bg-[#101014]">
                                      {bonus.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                                        <img
                                          src={bonus.image_url || "/placeholder.svg"}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <ImageIcon className="size-3 text-white/20" />
                                      )}
                                    </span>
                                    {bonus.is_super && <Crown className="w-3 h-3 text-amber-400" />}
                                    <div>
                                      <p className="text-white font-medium text-xs">{bonus.game_name}</p>
                                      {bonus.provider && <p className="text-white/40 text-[10px]">{bonus.provider}</p>}
                                    </div>
                                  </div>
                                  <p className="text-amber-400 font-medium text-xs">{multiplier}x</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                  <div>
                                    <p className="text-white/40">Bet</p>
                                    <p className="text-red-400 font-medium">${bonus.bet_size.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/40">Result</p>
                                    <p className="text-green-400 font-medium">
                                      {bonus.result !== null ? `$${bonus.result.toFixed(2)}` : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-white/40">P/L</p>
                                    <p className={`font-medium ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                      {bonus.result !== null ? `${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}` : "-"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
