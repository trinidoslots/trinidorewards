"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getActiveHunt, type ActiveHunt } from "@/lib/active-hunt"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Search, Play, Flag, RotateCcw, GripVertical, Crown } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type HuntBonus = {
  id: string
  hunt_id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  created_at: string
  is_super: boolean
  image_url?: string | null
  position: number
}

type Slot = {
  id: number
  game_name: string
  provider: string
}

function SortableBonusItem({
  bonus,
  onDelete,
  onToggleSuper,
}: {
  bonus: HuntBonus
  onDelete: (id: string) => void
  onToggleSuper: (id: string, isSuper: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bonus.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-800/50 border rounded-lg p-4 flex items-center justify-between ${bonus.is_super ? "border-amber-500/50 bg-amber-900/10" : "border-slate-700"}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-slate-400 hover:text-slate-300 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950">
          {bonus.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
            <img src={bonus.image_url || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="size-2 rounded-full bg-slate-600" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {bonus.is_super && <Crown className="w-4 h-4 text-amber-400" />}
            <div className={`w-2 h-2 rounded-full ${bonus.is_super ? "bg-amber-400" : "bg-cyan-400"}`}></div>
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
      </div>
      <div className="flex items-center gap-1">
        <Button
          onClick={() => onToggleSuper(bonus.id, !bonus.is_super)}
          variant="ghost"
          size="sm"
          className={`${bonus.is_super ? "text-amber-400 hover:text-amber-300 hover:bg-amber-900/20" : "text-slate-500 hover:text-amber-400 hover:bg-amber-900/20"}`}
          title={bonus.is_super ? "Remove Super" : "Mark as Super"}
        >
          <Crown className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => onDelete(bonus.id)}
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export default function AdminBonusHuntPage() {
  const [loading, setLoading] = useState(true)
  const [activeHunt, setActiveHunt] = useState<ActiveHunt | null>(null)
  const [bonuses, setBonuses] = useState<HuntBonus[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [filteredSlots, setFilteredSlots] = useState<Slot[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [streamer, setStreamer] = useState("")
  const [title, setTitle] = useState("")
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
      await fetchActiveHuntAndBonuses()
      await fetchSlots()
      setLoading(false)
    }
  }

  async function fetchActiveHuntAndBonuses() {
    const hunt = await getActiveHunt(supabase)
    setActiveHunt(hunt)

    if (!hunt) {
      setBonuses([])
      return
    }

    const { data, error } = await supabase
      .from("hunt_bonuses")
      .select("*")
      .eq("hunt_id", hunt.id)
      .order("position", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching hunt bonuses:", error)
    } else {
      setBonuses((data || []) as HuntBonus[])
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
    if (!streamer.trim() || !startingBalance) {
      toast({
        title: "Error",
        description: "Please fill in streamer and starting balance",
        variant: "destructive",
      })
      return
    }

    await supabase.from("bonus_hunts").update({ status: "ended", ended_at: new Date().toISOString() }).eq("status", "active")

    const { data: created, error } = await supabase
      .from("bonus_hunts")
      .insert({
        streamer: streamer.trim(),
        title: title.trim() || null,
        starting_balance: Number.parseFloat(startingBalance),
        status: "active",
      })
      .select("id, status, starting_balance, streamer, title, created_at, ended_at")
      .single()

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
      setActiveHunt(created as ActiveHunt)
      setBonuses([])
      setShowCreateModal(false)
      setStreamer("")
      setTitle("")
      setStartingBalance("")
    }
  }

  async function handleAddBonus(e: React.FormEvent) {
    e.preventDefault()

    if (!activeHunt) return

    // New bonuses always join the end of the queue.
    const { error } = await supabase.from("hunt_bonuses").insert({
      game_name: formData.game_name,
      provider: null,
      bet_size: Number.parseFloat(formData.bet_size),
      result: formData.result ? Number.parseFloat(formData.result) : null,
      hunt_id: activeHunt.id,
      position: bonuses.length,
    })

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
      fetchActiveHuntAndBonuses()
    }
  }

  async function handleToggleSuper(id: string, isSuper: boolean) {
    const { error } = await supabase.from("hunt_bonuses").update({ is_super: isSuper }).eq("id", id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update super status",
        variant: "destructive",
      })
    } else {
      setBonuses((prev) => prev.map((b) => (b.id === id ? { ...b, is_super: isSuper } : b)))
      toast({
        title: isSuper ? "Super Bonus!" : "Super Removed",
        description: isSuper ? "Bonus marked as Super" : "Super status removed",
        className: "bg-green-600 text-white",
      })
    }
  }

  async function handleDeleteBonus(id: string) {
    if (!confirm("Are you sure you want to delete this bonus?")) return

    const { error } = await supabase.from("hunt_bonuses").delete().eq("id", id)

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
      fetchActiveHuntAndBonuses()
    }
  }

  async function handleEndHunt() {
    if (!activeHunt) return
    if (!confirm("End this hunt? It will move to Past Hunts and a new hunt can be started.")) return

    const { error } = await supabase
      .from("bonus_hunts")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", activeHunt.id)

    if (error) {
      console.error("[v0] Error ending hunt:", error)
      toast({
        title: "Error",
        description: "Failed to end hunt",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Hunt ended and moved to Past Hunts",
        className: "bg-green-600 text-white",
      })
      setActiveHunt(null)
      setBonuses([])
    }
  }

  async function handleResetHunt() {
    if (!activeHunt) return
    if (!confirm("Are you sure you want to reset this hunt? This will delete all bonuses and cannot be undone.")) {
      return
    }

    const { error: predictionsError } = await supabase.from("hunt_predictions").delete().eq("hunt_id", activeHunt.id)
    if (predictionsError) {
      console.error("[v0] Error deleting predictions:", predictionsError)
    }

    await supabase.from("prediction_windows").delete().eq("hunt_id", activeHunt.id)
    await supabase.from("opening_state").upsert({ id: 1, is_opening: false })

    const { error: deleteBonusesError } = await supabase.from("hunt_bonuses").delete().eq("hunt_id", activeHunt.id)
    const { error: deleteError } = deleteBonusesError
      ? { error: deleteBonusesError }
      : await supabase.from("bonus_hunts").delete().eq("id", activeHunt.id)

    if (deleteError) {
      console.error("[v0] Error deleting hunt:", deleteError)
      toast({
        title: "Error",
        description: "Failed to reset hunt",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Success",
      description: "Hunt reset successfully",
      className: "bg-green-600 text-white",
    })

    setActiveHunt(null)
    setBonuses([])
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = bonuses.findIndex((b) => b.id === active.id)
    const newIndex = bonuses.findIndex((b) => b.id === over.id)

    const reorderedBonuses = arrayMove(bonuses, oldIndex, newIndex)
    setBonuses(reorderedBonuses)

    // Persist the new order to the stable `position` column (the source of
    // truth the extension reads as `order`). created_at is left untouched so
    // it keeps reflecting true insertion time.
    await Promise.all(
      reorderedBonuses.map((bonus, i) => supabase.from("hunt_bonuses").update({ position: i }).eq("id", bonus.id)),
    )

    toast({
      title: "Success",
      description: "Bonus order updated",
      className: "bg-green-600 text-white",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (!activeHunt) {
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
                <Label htmlFor="streamer" className="text-slate-300">
                  Streamer
                </Label>
                <Input
                  id="streamer"
                  value={streamer}
                  onChange={(e) => setStreamer(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., Syztmz"
                />
              </div>
              <div>
                <Label htmlFor="title" className="text-slate-300">
                  Title <span className="text-slate-500">(optional)</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="e.g., Friday Night Hunt"
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
              <div>
                <h2 className="text-white text-xl font-bold">Current Hunt</h2>
                <p className="text-slate-400 text-sm">
                  {activeHunt.streamer}
                  {activeHunt.title ? ` · ${activeHunt.title}` : ""} · ${activeHunt.starting_balance.toFixed(2)} start
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleEndHunt} className="bg-green-600 hover:bg-green-700" size="sm">
                  <Flag className="w-4 h-4 mr-2" />
                  End Hunt
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

            {bonuses.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No bonuses added yet</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={bonuses.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {bonuses.map((bonus) => (
                      <SortableBonusItem key={bonus.id} bonus={bonus} onDelete={handleDeleteBonus} onToggleSuper={handleToggleSuper} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
