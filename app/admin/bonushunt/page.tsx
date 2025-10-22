"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Search, Play, Save, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type BonusHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  hunt_id: string | null
  created_at: string
  starting_balance: number
  opening_balance: number
}

type Slot = {
  id: number
  game_name: string
  provider: string
}

export default function AdminBonusHuntPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bonusHunts, setBonusHunts] = useState<BonusHunt[]>([])
  const [activeHuntId, setActiveHuntId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [filteredSlots, setFilteredSlots] = useState<Slot[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [huntName, setHuntName] = useState("")
  const [huntId, setHuntId] = useState("")
  const [startingBalance, setStartingBalance] = useState("")
  const [formData, setFormData] = useState({
    game_name: "",
    bet_size: "",
    result: "",
  })
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const filtered = slots.filter(
        (slot) =>
          slot.game_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          slot.provider.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredSlots(filtered)
    } else {
      setFilteredSlots(slots)
    }
  }, [searchQuery, slots])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
    } else {
      setUser(user)
      await fetchBonusHunts()
      await fetchSlots()
      setLoading(false)
    }
  }

  async function fetchBonusHunts() {
    const { data, error } = await supabase.from("bonus_hunts").select("*").order("created_at", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching bonus hunts:", error)
    } else {
      const hunts = (data || []) as BonusHunt[]
      const activeHunt = hunts.find((h) => h.hunt_id)
      if (activeHunt) {
        setActiveHuntId(activeHunt.hunt_id)
      }
      const filtered = hunts.filter((h) => h.game_name !== "_temp_balance_holder")
      setBonusHunts(filtered)
    }
  }

  async function fetchSlots() {
    let allSlots: Slot[] = []
    let from = 0
    const batchSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from("slots")
        .select("*")
        .range(from, from + batchSize - 1)
        .order("provider", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching slots:", error)
        break
      }

      if (!data || data.length === 0) break

      allSlots = [...allSlots, ...(data as Slot[])]

      if (data.length < batchSize) break

      from += batchSize
    }

    setSlots(allSlots)
    setFilteredSlots(allSlots)
  }

  async function handleCreateHunt() {
    if (!huntId || !startingBalance) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    const { data: existing } = await supabase.from("bonus_hunts").select("*").eq("hunt_id", huntId).limit(1)

    if (existing && existing.length > 0) {
      toast({
        title: "Error",
        description: "A hunt with this ID already exists",
        variant: "destructive",
      })
      return
    }

    const { error } = await supabase.from("bonus_hunts").insert([
      {
        game_name: "_temp_balance_holder",
        provider: null,
        bet_size: 0,
        result: 0,
        hunt_id: huntId,
        starting_balance: Number.parseFloat(startingBalance),
        opening_balance: Number.parseFloat(startingBalance),
      },
    ])

    if (error) {
      console.error("[v0] Error creating hunt:", error)
      toast({
        title: "Error",
        description: "Failed to create hunt",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Hunt created successfully",
        className: "bg-green-600 text-white",
      })
      setActiveHuntId(huntId)
      setShowCreateModal(false)
      setHuntId("")
      setStartingBalance("")
      await fetchBonusHunts()
    }
  }

  async function handleAddBonus(e: React.FormEvent) {
    e.preventDefault()

    const { error } = await supabase.from("bonus_hunts").insert([
      {
        game_name: formData.game_name,
        provider: null,
        bet_size: Number.parseFloat(formData.bet_size),
        result: formData.result ? Number.parseFloat(formData.result) : null,
        hunt_id: activeHuntId,
      },
    ])

    if (error) {
      console.error("[v0] Error adding bonus:", error)
      toast({
        title: "Error",
        description: "Failed to add bonus",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Bonus added successfully",
        className: "bg-green-600 text-white",
      })
      setFormData({ game_name: "", bet_size: "", result: "" })
      fetchBonusHunts()
    }
  }

  async function handleDeleteBonus(id: string) {
    if (!confirm("Are you sure you want to delete this bonus?")) return

    const { error } = await supabase.from("bonus_hunts").delete().eq("id", id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete bonus",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Bonus deleted successfully",
        className: "bg-green-600 text-white",
      })
      fetchBonusHunts()
    }
  }

  async function handleSaveHunt() {
    if (!huntName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a hunt name",
        variant: "destructive",
      })
      return
    }

    const totalBonuses = bonusHunts.length
    const totalBetSize = bonusHunts.reduce((sum, b) => sum + b.bet_size, 0)
    const totalResult = bonusHunts.reduce((sum, b) => sum + (b.result || 0), 0)
    const startingBal = bonusHunts[0]?.starting_balance || 0
    const profitLoss = totalResult - totalBetSize

    const bonusesData = bonusHunts.map((b) => ({
      game_name: b.game_name,
      provider: b.provider,
      bet_size: b.bet_size,
      result: b.result,
      multiplier: b.result && b.bet_size ? b.result / b.bet_size : 0,
    }))

    const { error } = await supabase.from("past_bonushunts").insert([
      {
        hunt_id: activeHuntId,
        hunt_name: huntName,
        starting_balance: startingBal,
        opening_balance: startingBal,
        total_bonuses: totalBonuses,
        total_bet_size: totalBetSize,
        total_result: totalResult,
        profit_loss: profitLoss,
        bonuses: bonusesData,
        status: "completed",
      },
    ])

    if (error) {
      console.error("[v0] Error saving hunt:", error)
      toast({
        title: "Error",
        description: "Failed to save hunt to previous hunts",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Hunt saved to previous hunts successfully",
        className: "bg-green-600 text-white",
      })
      setShowSaveModal(false)
      setHuntName("")
    }
  }

  async function handleResetHunt() {
    if (!confirm("Are you sure you want to reset this hunt? This will delete all bonuses and cannot be undone.")) {
      return
    }

    const { error: deleteError } = await supabase.from("bonus_hunts").delete().eq("hunt_id", activeHuntId)

    if (deleteError) {
      console.error("[v0] Error deleting hunt:", deleteError)
      toast({
        title: "Error",
        description: "Failed to reset hunt",
        variant: "destructive",
      })
      return
    }

    await supabase.from("opening_state").delete().eq("hunt_id", activeHuntId)

    toast({
      title: "Success",
      description: "Hunt reset successfully",
      className: "bg-green-600 text-white",
    })

    router.push("/admin/users")
  }

  function selectSlot(slot: Slot) {
    setFormData({ ...formData, game_name: slot.game_name })
    setSearchQuery("")
  }

  const groupedSlots = filteredSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.provider]) {
        acc[slot.provider] = []
      }
      acc[slot.provider].push(slot)
      return acc
    },
    {} as Record<string, Slot[]>,
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (!activeHuntId) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-white text-2xl font-bold mb-4">No Active Bonus Hunt</h2>
          <p className="text-slate-400 mb-6">Create a new bonus hunt to get started</p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Bonus Hunt
          </Button>
        </div>

        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Create New Bonus Hunt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="hunt_id" className="text-slate-300">
                  Hunt ID
                </Label>
                <Input
                  id="hunt_id"
                  value={huntId}
                  onChange={(e) => setHuntId(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., hunt-001"
                />
              </div>
              <div>
                <Label htmlFor="starting_balance" className="text-slate-300">
                  Starting Balance ($)
                </Label>
                <Input
                  id="starting_balance"
                  type="number"
                  step="0.01"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0.00"
                />
              </div>
              <Button onClick={handleCreateHunt} className="w-full bg-cyan-600 hover:bg-cyan-700">
                Create Hunt
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="p-4 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add to Bonus Hunt
            </h2>

            <form onSubmit={handleAddBonus} className="space-y-4">
              <div>
                <Label htmlFor="game_name" className="text-slate-300 text-sm">
                  Game Name
                </Label>
                <Input
                  id="game_name"
                  value={formData.game_name}
                  onChange={(e) => setFormData({ ...formData, game_name: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Search or type game name..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="bet_size" className="text-slate-300 text-sm">
                  Bet Size ($)
                </Label>
                <Input
                  id="bet_size"
                  type="number"
                  step="0.01"
                  value={formData.bet_size}
                  onChange={(e) => setFormData({ ...formData, bet_size: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="result" className="text-slate-300 text-sm">
                  Result Amount ($)
                </Label>
                <p className="text-xs text-slate-400 mb-2">Optional</p>
                <Input
                  id="result"
                  type="number"
                  step="0.01"
                  value={formData.result}
                  onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0.00 (optional)"
                />
              </div>

              <Button type="submit" className="w-full bg-slate-700 hover:bg-slate-600">
                Add Bonus Hunt
              </Button>
            </form>

            <div className="mt-6">
              <h3 className="text-white font-semibold mb-3">Available Slots</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white pl-10"
                  placeholder="Search slots..."
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-3">
                {Object.entries(groupedSlots).map(([provider, providerSlots]) => (
                  <div key={provider}>
                    <h4 className="text-amber-400 font-semibold text-sm mb-2">{provider}</h4>
                    <div className="space-y-1 ml-2">
                      {providerSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => selectSlot(slot)}
                          className="text-slate-300 hover:text-white text-sm block w-full text-left py-1 px-2 rounded hover:bg-slate-800 transition-colors"
                        >
                          {slot.game_name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold">Current Hunt</h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowSaveModal(true)}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                  disabled={bonusHunts.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Hunt
                </Button>
                <Button
                  onClick={handleResetHunt}
                  className="bg-red-600 hover:bg-red-700"
                  size="sm"
                  variant="destructive"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button
                  onClick={() => router.push("/admin/bonushunt/opening")}
                  className="bg-cyan-600 hover:bg-cyan-700"
                  size="sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Opening Mode
                </Button>
              </div>
            </div>

            {bonusHunts.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No bonuses added yet</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {bonusHunts.map((bonus) => (
                  <div
                    key={bonus.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                        <h3 className="text-white font-semibold">{bonus.game_name}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Bet</span>
                          <span className="text-red-400 ml-2 font-semibold">${bonus.bet_size.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Result</span>
                          <span className="text-white ml-2 font-semibold">
                            {bonus.result !== null ? `$${bonus.result.toFixed(2)}` : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDeleteBonus(bonus.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Save Hunt to Previous Hunts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="hunt_name" className="text-slate-300">
                Hunt Name
              </Label>
              <Input
                id="hunt_name"
                value={huntName}
                onChange={(e) => setHuntName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="e.g., Epic Bonus Hunt #1"
              />
            </div>
            <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bonuses:</span>
                <span className="text-white font-semibold">{bonusHunts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bet:</span>
                <span className="text-white font-semibold">
                  ${bonusHunts.reduce((sum, b) => sum + b.bet_size, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Result:</span>
                <span className="text-white font-semibold">
                  ${bonusHunts.reduce((sum, b) => sum + (b.result || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
            <Button onClick={handleSaveHunt} className="w-full bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              Save to Previous Hunts
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
