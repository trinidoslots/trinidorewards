"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Edit2, Save, X, ChevronDown, ChevronUp, History } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type PastHunt = {
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
  status?: string
}

type BonusDetail = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
}

export default function AdminHistoryPage() {
  const [pastHunts, setPastHunts] = useState<PastHunt[]>([])
  const [expandedHunt, setExpandedHunt] = useState<string | null>(null)
  const [editingHunt, setEditingHunt] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    hunt_name: "",
    starting_balance: "",
    opening_balance: "",
  })
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    fetchPastHunts()
  }, [])

  async function fetchPastHunts() {
    const { data, error } = await supabase.from("past_bonushunts").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching past hunts:", error)
      toast({
        title: "Error",
        description: "Failed to fetch past hunts",
        variant: "destructive",
      })
    } else {
      setPastHunts(data || [])
    }
  }

  async function handleDelete(huntId: string) {
    if (!confirm("Are you sure you want to delete this hunt? This action cannot be undone.")) {
      return
    }

    const { error } = await supabase.from("past_bonushunts").delete().eq("id", huntId)

    if (error) {
      console.error("Error deleting hunt:", error)
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
      fetchPastHunts()
      if (expandedHunt === huntId) {
        setExpandedHunt(null)
      }
    }
  }

  function toggleHuntExpansion(huntId: string) {
    setExpandedHunt(expandedHunt === huntId ? null : huntId)
  }

  function startEditing(hunt: PastHunt) {
    setEditingHunt(hunt.id)
    setEditForm({
      hunt_name: hunt.hunt_name,
      starting_balance: hunt.starting_balance.toString(),
      opening_balance: hunt.opening_balance.toString(),
    })
  }

  async function saveEdit(huntId: string) {
    const updates = {
      hunt_name: editForm.hunt_name,
      starting_balance: Number.parseFloat(editForm.starting_balance),
      opening_balance: Number.parseFloat(editForm.opening_balance),
    }

    const { error } = await supabase.from("past_bonushunts").update(updates).eq("id", huntId)

    if (error) {
      console.error("Error updating hunt:", error)
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
    setEditForm({
      hunt_name: "",
      starting_balance: "",
      opening_balance: "",
    })
  }

  function getBonusDetails(hunt: PastHunt): BonusDetail[] {
    try {
      return JSON.parse(hunt.bonuses) as BonusDetail[]
    } catch (error) {
      console.error("Error parsing bonuses:", error)
      return []
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Hunt History</h1>
        <p className="text-xs text-slate-400">View and manage your past bonus hunts</p>
      </div>

      <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
        <CardHeader className="p-3">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <History className="w-4 h-4" />
            Past Hunts ({pastHunts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {pastHunts.length === 0 ? (
            <p className="text-slate-400 text-center py-6 text-xs">No past hunts yet</p>
          ) : (
            <div className="space-y-2">
              {pastHunts.map((hunt) => {
                const isExpanded = expandedHunt === hunt.id
                const bonusDetails = isExpanded ? getBonusDetails(hunt) : []
                const winRate =
                  hunt.total_bet_size > 0 ? ((hunt.total_result / hunt.total_bet_size) * 100).toFixed(1) : "0"

                return (
                  <div
                    key={hunt.id}
                    className="bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-colors overflow-hidden"
                  >
                    <div className="p-3">
                      {editingHunt === hunt.id ? (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-slate-300 text-xs">Hunt Name</Label>
                            <Input
                              value={editForm.hunt_name}
                              onChange={(e) => setEditForm({ ...editForm, hunt_name: e.target.value })}
                              className="bg-slate-900 border-slate-700 text-white mt-1 h-8 text-xs"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-slate-300 text-xs">Starting Balance</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editForm.starting_balance}
                                onChange={(e) => setEditForm({ ...editForm, starting_balance: e.target.value })}
                                className="bg-slate-900 border-slate-700 text-white mt-1 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-slate-300 text-xs">Opening Balance</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editForm.opening_balance}
                                onChange={(e) => setEditForm({ ...editForm, opening_balance: e.target.value })}
                                className="bg-slate-900 border-slate-700 text-white mt-1 h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEdit(hunt.id)}
                              className="flex-1 bg-cyan-600 hover:bg-cyan-700 h-7 text-xs"
                            >
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              className="flex-1 bg-transparent border-slate-600 text-slate-300 hover:text-white h-7 text-xs"
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
                                <h3 className="text-white font-semibold text-sm">{hunt.hunt_name}</h3>
                                <span className="text-slate-400 text-[10px]">
                                  {new Date(hunt.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {hunt.status && <p className="text-cyan-400 text-[10px] mt-0.5">{hunt.status}</p>}
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
                                onClick={() => handleDelete(hunt.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-950/50 h-7 w-7 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleHuntExpansion(hunt.id)}
                                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/50 h-7 w-7 p-0"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <p className="text-slate-400">Bonuses</p>
                              <p className="text-white font-medium">{hunt.total_bonuses}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total Bet</p>
                              <p className="text-red-400 font-medium">${hunt.total_bet_size.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">Total Result</p>
                              <p className="text-green-400 font-medium">${hunt.total_result.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400">P/L</p>
                              <p className={`font-medium ${hunt.profit_loss >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {hunt.profit_loss >= 0 ? "+" : ""}${hunt.profit_loss.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-700 bg-slate-900/30 p-3">
                        <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                          <div>
                            <p className="text-slate-400">Starting Balance</p>
                            <p className="text-white font-medium">${hunt.starting_balance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Opening Balance</p>
                            <p className="text-white font-medium">${hunt.opening_balance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Win Rate</p>
                            <p className="text-white font-medium">{winRate}%</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Avg Multiplier</p>
                            <p className="text-amber-400 font-medium">
                              {hunt.total_bonuses > 0
                                ? (hunt.total_result / hunt.total_bet_size / hunt.total_bonuses).toFixed(2)
                                : "0.00"}
                              x
                            </p>
                          </div>
                        </div>

                        <h4 className="text-white font-medium mb-2 text-xs">Bonuses ({bonusDetails.length})</h4>
                        <div className="space-y-1 max-h-[400px] overflow-y-auto">
                          {bonusDetails.map((bonus, index) => {
                            const multiplier =
                              bonus.result && bonus.bet_size ? (bonus.result / bonus.bet_size).toFixed(2) : "0.00"
                            const profit = (bonus.result || 0) - bonus.bet_size

                            return (
                              <div
                                key={bonus.id || index}
                                className="bg-slate-800/50 p-2 rounded border border-slate-700"
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <div>
                                    <p className="text-white font-medium text-xs">{bonus.game_name}</p>
                                    {bonus.provider && <p className="text-slate-400 text-[10px]">{bonus.provider}</p>}
                                  </div>
                                  <p className="text-amber-400 font-medium text-xs">{multiplier}x</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                  <div>
                                    <p className="text-slate-400">Bet</p>
                                    <p className="text-red-400 font-medium">${bonus.bet_size.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">Result</p>
                                    <p className="text-green-400 font-medium">
                                      {bonus.result !== null ? `$${bonus.result.toFixed(2)}` : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400">P/L</p>
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
