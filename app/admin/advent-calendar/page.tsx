"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Calendar, Gift, Users, Edit, Save, X, Plus, Trash2 } from "lucide-react"

interface AdventReward {
  id: string
  day_number: number
  title: string
  description: string
  icon: string
  reward_type: string
  reward_value: string
  is_active: boolean
  probability: number
  display_order: number
}

interface ClaimStats {
  day_number: number
  claim_count: number
}

export default function AdminAdventCalendarPage() {
  const [rewardsByDay, setRewardsByDay] = useState<Record<number, AdventReward[]>>({})
  const [claimStats, setClaimStats] = useState<ClaimStats[]>([])
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [editRewards, setEditRewards] = useState<AdventReward[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    // Fetch rewards
    const { data: rewardsData, error: rewardsError } = await supabase
      .from("advent_calendar_rewards")
      .select("*")
      .order("day_number", { ascending: true })
      .order("display_order", { ascending: true })

    if (rewardsError) {
      console.error("[v0] Error fetching rewards:", rewardsError)
      toast({
        title: "Error",
        description: "Failed to fetch rewards",
        variant: "destructive",
      })
    } else {
      // Group by day
      const grouped: Record<number, AdventReward[]> = {}
      for (const reward of rewardsData as AdventReward[]) {
        if (!grouped[reward.day_number]) {
          grouped[reward.day_number] = []
        }
        grouped[reward.day_number].push(reward)
      }
      setRewardsByDay(grouped)
    }

    // Fetch claim statistics
    const { data: claimsData, error: claimsError } = await supabase.from("advent_calendar_claims").select("day_number")

    if (!claimsError && claimsData) {
      const stats = claimsData.reduce((acc: any, claim) => {
        acc[claim.day_number] = (acc[claim.day_number] || 0) + 1
        return acc
      }, {})

      setClaimStats(
        Object.entries(stats).map(([day, count]) => ({
          day_number: Number.parseInt(day),
          claim_count: count as number,
        })),
      )
    }

    setLoading(false)
  }

  const handleEdit = (dayNumber: number) => {
    setEditingDay(dayNumber)
    setEditRewards(rewardsByDay[dayNumber] || [])
  }

  const handleAddReward = () => {
    if (!editingDay) return

    const newReward: AdventReward = {
      id: `temp-${Date.now()}`,
      day_number: editingDay,
      title: "",
      description: "",
      icon: "🎁",
      reward_type: "bonus",
      reward_value: "",
      is_active: true,
      probability: 0,
      display_order: editRewards.length,
    }

    setEditRewards([...editRewards, newReward])
  }

  const handleRemoveReward = (index: number) => {
    setEditRewards(editRewards.filter((_, i) => i !== index))
  }

  const handleUpdateReward = (index: number, field: keyof AdventReward, value: any) => {
    const updated = [...editRewards]
    updated[index] = { ...updated[index], [field]: value }
    setEditRewards(updated)
  }

  const getTotalProbability = () => {
    return editRewards.reduce((sum, r) => sum + (Number(r.probability) || 0), 0)
  }

  const handleSave = async () => {
    if (!editingDay) return

    const totalProb = getTotalProbability()
    if (Math.abs(totalProb - 100) > 0.01) {
      toast({
        title: "Invalid Probabilities",
        description: `Total probability must equal 100% (currently ${totalProb.toFixed(2)}%)`,
        variant: "destructive",
      })
      return
    }

    try {
      // Delete existing rewards for this day
      const existingIds = (rewardsByDay[editingDay] || []).map((r) => r.id)
      if (existingIds.length > 0) {
        await supabase.from("advent_calendar_rewards").delete().in("id", existingIds)
      }

      // Insert new rewards
      const rewardsToInsert = editRewards.map((reward, index) => ({
        day_number: editingDay,
        title: reward.title,
        description: reward.description,
        icon: reward.icon,
        reward_type: reward.reward_type,
        reward_value: reward.reward_value,
        is_active: reward.is_active,
        probability: Number(reward.probability),
        display_order: index,
      }))

      const { error } = await supabase.from("advent_calendar_rewards").insert(rewardsToInsert)

      if (error) throw error

      toast({
        title: "Success",
        description: "Rewards updated successfully",
        className: "bg-green-600 text-white",
      })

      setEditingDay(null)
      fetchData()
    } catch (error: any) {
      console.error("[v0] Error saving rewards:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update rewards",
        variant: "destructive",
      })
    }
  }

  const getClaimCount = (dayNumber: number) => {
    return claimStats.find((s) => s.day_number === dayNumber)?.claim_count || 0
  }

  const totalClaims = claimStats.reduce((sum, stat) => sum + stat.claim_count, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="text-white text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Advent Calendar Management</h1>
          <p className="text-slate-400">Manage daily rewards with randomized probabilities</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Total Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">24</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Total Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{totalClaims}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">{Object.values(rewardsByDay).flat().length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Days List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((dayNumber) => {
            const dayRewards = rewardsByDay[dayNumber] || []

            return (
              <Card key={dayNumber} className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span>Day {dayNumber}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(dayNumber)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingDay === dayNumber ? (
                    <div className="space-y-4">
                      {editRewards.map((reward, index) => (
                        <div key={index} className="p-3 bg-slate-800 rounded-lg space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400">Reward {index + 1}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveReward(index)}
                              className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-slate-400 text-xs">Icon</Label>
                              <Input
                                value={reward.icon}
                                onChange={(e) => handleUpdateReward(index, "icon", e.target.value)}
                                className="bg-slate-700 border-slate-600 text-white h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-slate-400 text-xs">Probability %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={reward.probability}
                                onChange={(e) =>
                                  handleUpdateReward(index, "probability", Number.parseFloat(e.target.value) || 0)
                                }
                                className="bg-slate-700 border-slate-600 text-white h-8"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-slate-400 text-xs">Title</Label>
                            <Input
                              value={reward.title}
                              onChange={(e) => handleUpdateReward(index, "title", e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white h-8"
                            />
                          </div>

                          <div>
                            <Label className="text-slate-400 text-xs">Description</Label>
                            <Textarea
                              value={reward.description}
                              onChange={(e) => handleUpdateReward(index, "description", e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white"
                              rows={2}
                            />
                          </div>

                          <div>
                            <Label className="text-slate-400 text-xs">Reward Value</Label>
                            <Input
                              value={reward.reward_value}
                              onChange={(e) => handleUpdateReward(index, "reward_value", e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white h-8"
                            />
                          </div>
                        </div>
                      ))}

                      <Button onClick={handleAddReward} variant="outline" className="w-full bg-transparent" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Reward
                      </Button>

                      <div className="text-xs text-center">
                        <span className={getTotalProbability() === 100 ? "text-green-400" : "text-red-400"}>
                          Total: {getTotalProbability().toFixed(2)}%
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700" size="sm">
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={() => setEditingDay(null)} variant="outline" className="flex-1" size="sm">
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayRewards.length === 0 ? (
                        <p className="text-slate-500 text-sm">No rewards configured</p>
                      ) : (
                        dayRewards.map((reward, index) => (
                          <div key={reward.id} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-white">
                                {reward.icon} {reward.title}
                              </span>
                              <span className="text-yellow-400">{reward.probability}%</span>
                            </div>
                          </div>
                        ))
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <span className="text-slate-500 text-xs">Claims</span>
                        <span className="text-green-400 font-semibold">{getClaimCount(dayNumber)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
