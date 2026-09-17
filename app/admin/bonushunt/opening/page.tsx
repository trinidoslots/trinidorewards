"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getActiveHunt, type ActiveHunt } from "@/lib/active-hunt"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Flag,
  Keyboard,
  Percent,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Target,
  Layers,
  Scale,
  CheckCircle2,
  ImageIcon,
} from "lucide-react"

type HuntBonus = {
  id: string
  hunt_id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  created_at: string
  is_super: boolean
  image_url: string | null
}

function money(value: number) {
  return `C$${value.toFixed(2)}`
}

export default function OpeningModePage() {
  const [loading, setLoading] = useState(true)
  const [activeHunt, setActiveHunt] = useState<ActiveHunt | null>(null)
  const [openingBonuses, setOpeningBonuses] = useState<HuntBonus[]>([])
  const [currentOpeningIndex, setCurrentOpeningIndex] = useState(0)
  const [payout, setPayout] = useState("")
  const [multiplier, setMultiplier] = useState("")
  const [notes, setNotes] = useState("")
  const [obsViewMode, setObsViewMode] = useState<"opening" | "normal">("opening")
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
    loadObsViewMode()
  }, [])

  async function loadObsViewMode() {
    const { data } = await supabase.from("settings").select("value").eq("key", "obs_view_mode").single()
    if (data) {
      setObsViewMode(data.value as "opening" | "normal")
    }
  }

  async function toggleObsViewMode() {
    const newMode = obsViewMode === "opening" ? "normal" : "opening"
    setObsViewMode(newMode)

    const { error } = await supabase
      .from("settings")
      .upsert({ key: "obs_view_mode", value: newMode }, { onConflict: "key" })

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update OBS view mode",
        variant: "destructive",
      })
    }
  }

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
    } else {
      await startOpeningMode()
      setLoading(false)
    }
  }

  async function startOpeningMode() {
    const hunt = await getActiveHunt(supabase)
    setActiveHunt(hunt)

    const { data, error } = hunt
      ? await supabase
          .from("hunt_bonuses")
          .select("*")
          .eq("hunt_id", hunt.id)
          .order("position", { ascending: true })
      : { data: [], error: null }

    if (error || !data) {
      console.error("[v0] Error fetching hunt bonuses:", error)
      toast({
        title: "Error",
        description: "Failed to fetch bonus hunts",
        variant: "destructive",
      })
      return
    }

    const allBonuses = data as HuntBonus[]

    if (allBonuses.length === 0) {
      toast({
        title: "Info",
        description: "No bonuses available",
      })
      return
    }

    setOpeningBonuses(allBonuses)
    setCurrentOpeningIndex(0)

    const firstBonus = allBonuses[0]
    setPayout(firstBonus?.result?.toString() || "")
    setMultiplier(
      firstBonus?.result && firstBonus?.bet_size ? (firstBonus.result / firstBonus.bet_size).toFixed(2) : "",
    )
    setNotes("")

    // Update opening state in database
    await supabase.from("opening_state").upsert({
      id: 1,
      is_opening: true,
    })

    setTimeout(() => {
      const input = document.getElementById("payout_input")
      if (input) input.focus()
    }, 100)
  }

  async function saveAndNextOpening() {
    if (!payout) {
      toast({ title: "Error", description: "Please enter payout", variant: "destructive" })
      return
    }

    const currentBonus = openingBonuses[currentOpeningIndex]
    const result = Number.parseFloat(payout)

    if (isNaN(result)) {
      toast({ title: "Error", description: "Please enter a valid number", variant: "destructive" })
      return
    }

    const { error } = await supabase.from("hunt_bonuses").update({ result }).eq("id", currentBonus.id)
    if (error) {
      toast({ title: "Error", description: "Failed to update bonus hunt", variant: "destructive" })
      return
    }

    const updatedBonuses = [...openingBonuses]
    updatedBonuses[currentOpeningIndex] = { ...currentBonus, result }
    setOpeningBonuses(updatedBonuses)

    const nextIndex = currentOpeningIndex + 1
    if (nextIndex < updatedBonuses.length) {
      setCurrentOpeningIndex(nextIndex)
      const nextBonus = updatedBonuses[nextIndex]
      setPayout(nextBonus?.result?.toString() || "")
      setMultiplier(nextBonus?.result && nextBonus?.bet_size ? (nextBonus.result / nextBonus.bet_size).toFixed(2) : "")
      setNotes("")

      setTimeout(() => {
        const input = document.getElementById("payout_input")
        if (input) input.focus()
      }, 50)
    } else {
      await exitOpeningMode()
      toast({ title: "Success", description: "All bonuses opened!", className: "bg-green-600 text-white" })
    }
  }

  async function exitOpeningMode() {
    await supabase.from("opening_state").upsert({
      id: 1,
      is_opening: false,
    })

    router.push("/admin/bonushunt")
  }

  function selectBonusInOpening(index: number) {
    if (index < 0 || index >= openingBonuses.length) return
    setCurrentOpeningIndex(index)
    const bonus = openingBonuses[index]
    setPayout(bonus.result?.toString() || "")
    setMultiplier(bonus.result && bonus.bet_size ? (bonus.result / bonus.bet_size).toFixed(2) : "")
    setNotes("")

    setTimeout(() => {
      const input = document.getElementById("payout_input")
      if (input) input.focus()
    }, 50)
  }

  function goBackBonus() {
    selectBonusInOpening(currentOpeningIndex - 1)
  }

  function goForwardBonus() {
    selectBonusInOpening(currentOpeningIndex + 1)
  }

  function copySlotName() {
    const currentBonus = openingBonuses[currentOpeningIndex]
    if (currentBonus) {
      navigator.clipboard.writeText(currentBonus.game_name)
      toast({
        title: "Copied!",
        description: `${currentBonus.game_name} copied to clipboard`,
      })
    }
  }

  async function endHunt() {
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
      return
    }

    await supabase.from("opening_state").upsert({ id: 1, is_opening: false })

    toast({
      title: "Success",
      description: "Hunt ended and moved to Past Hunts",
      className: "bg-green-600 text-white",
    })

    router.push("/admin/bonushunt")
  }

  async function resetHunt() {
    if (!activeHunt) return
    if (!confirm("Are you sure you want to reset this hunt? This will delete all bonuses and cannot be undone.")) {
      return
    }

    try {
      const { error: predictionsError } = await supabase.from("hunt_predictions").delete().eq("hunt_id", activeHunt.id)
      if (predictionsError) {
        console.error("[v0] Error deleting predictions:", predictionsError)
        // Continue anyway, don't block the reset
      }

      await supabase.from("prediction_windows").delete().eq("hunt_id", activeHunt.id)

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

      // Reset opening state
      await supabase.from("opening_state").upsert({
        id: 1,
        is_opening: false,
      })

      toast({
        title: "Success",
        description: "Hunt reset successfully",
        className: "bg-green-600 text-white",
      })

      router.push("/admin/bonushunt")
    } catch (error) {
      console.error("[v0] Error resetting hunt:", error)
      toast({
        title: "Error",
        description: "Failed to reset hunt",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D]">
        <p className="text-white/60">Loading...</p>
      </div>
    )
  }

  if (openingBonuses.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.022] p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold text-white">No Bonuses to Open</h2>
          <p className="mb-6 text-white/40">Add bonuses to your hunt first</p>
          <Button onClick={() => router.push("/admin/bonushunt")} className="bg-[#5B8DEF] hover:bg-[#4A7AD8]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bonus Hunt
          </Button>
        </div>
      </div>
    )
  }

  const currentBonus = openingBonuses[currentOpeningIndex]
  const progress = currentOpeningIndex + 1
  const total = openingBonuses.length

  const openedBonuses = openingBonuses.filter((b) => b.result !== null)
  const startingBalanceVal = Number(activeHunt?.starting_balance ?? 0)
  const totalWon = openedBonuses.reduce((sum, b) => sum + (Number(b.result) || 0), 0)
  const profitLoss = totalWon - startingBalanceVal

  const totalMultiplierSum = openedBonuses.reduce((sum, b) => {
    if (b.result && b.bet_size) return sum + Number(b.result) / Number(b.bet_size)
    return sum
  }, 0)
  const runAvgX = openedBonuses.length > 0 ? totalMultiplierSum / openedBonuses.length : 0

  const remainingToOpen = openingBonuses.filter((b) => b.result === null)
  const remainingBetSize = remainingToOpen.reduce((sum, b) => sum + Number(b.bet_size), 0)
  const breakEvenAmount = Math.max(0, startingBalanceVal - totalWon)
  const reqAvgX = remainingBetSize > 0 ? breakEvenAmount / remainingBetSize : 0

  const nextBonus = openingBonuses[currentOpeningIndex + 1] ?? null

  const kpis: { label: string; value: string; icon: typeof Percent; accent?: "up" | "down" }[] = [
    { label: "Progress", value: `${progress} / ${total}`, icon: Percent },
    { label: "Start Cost", value: money(startingBalanceVal), icon: DollarSign },
    { label: "Winnings", value: money(totalWon), icon: TrendingUp },
    {
      label: "P&L",
      value: `${profitLoss >= 0 ? "+" : ""}${money(profitLoss)}`,
      icon: profitLoss >= 0 ? TrendingUp : TrendingDown,
      accent: profitLoss >= 0 ? "up" : "down",
    },
    { label: "Remaining", value: `${remainingToOpen.length}`, icon: Users },
    { label: "Run Avg", value: `${runAvgX.toFixed(2)}x`, icon: Activity },
    { label: "Req Avg", value: `${reqAvgX.toFixed(2)}x`, icon: Target },
    { label: "Cum. X", value: `${totalMultiplierSum.toFixed(2)}x`, icon: Layers },
    { label: "Break Even", value: money(breakEvenAmount), icon: Scale },
    { label: "Opened", value: `${openedBonuses.length} / ${total}`, icon: CheckCircle2 },
  ]

  return (
    <div className="min-h-screen bg-[#0B0B0D] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              {activeHunt?.streamer || "Bonus Hunt"}
              {activeHunt?.title ? ` — ${activeHunt.title}` : ""}
            </h1>
            <p className="text-sm text-white/30">
              {activeHunt?.created_at
                ? new Date(activeHunt.created_at).toLocaleDateString(undefined, {
                    month: "2-digit",
                    day: "2-digit",
                    year: "numeric",
                  })
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={toggleObsViewMode}
              size="sm"
              className={
                obsViewMode === "opening"
                  ? "bg-[#5B8DEF] text-white hover:bg-[#5B8DEF]"
                  : "bg-white/[0.06] text-white/80 hover:bg-white/[0.08]"
              }
              title={obsViewMode === "opening" ? "Switch OBS to normal view" : "Switch OBS to opening view"}
            >
              OBS: {obsViewMode === "opening" ? "Opening" : "Normal"}
            </Button>
            <Button onClick={endHunt} size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
              <Flag className="mr-1.5 h-3.5 w-3.5" />
              End Hunt
            </Button>
            <Button onClick={resetHunt} size="sm" variant="destructive">
              Reset Hunt
            </Button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {kpis.map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.022] p-3.5 transition hover:-translate-y-0.5 hover:border-[#5B8DEF]/25"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#5B8DEF]/10 text-[#7FA8F5]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</p>
                <p
                  className={`truncate text-base font-bold ${
                    accent === "up" ? "text-emerald-400" : accent === "down" ? "text-rose-400" : "text-white"
                  }`}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Back to hunt / hotkeys row */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/admin/bonushunt")}
            className="flex items-center gap-1.5 text-sm text-white/40 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Hunt
          </button>
          <div
            className="flex items-center gap-1.5 text-sm text-white/30"
            title="Enter = Save &amp; continue · Esc = Exit opening mode"
          >
            <Keyboard className="h-4 w-4" />
            Hotkeys
          </div>
        </div>

        {/* Main opening card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.022] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-[#0B0B0D]">
                {currentBonus.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                  <img
                    src={currentBonus.image_url || "/placeholder.svg"}
                    alt={currentBonus.game_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-white/20" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{currentBonus.game_name}</h2>
                  {currentBonus.is_super && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      <Crown className="h-3 w-3" /> Super
                    </span>
                  )}
                  {currentBonus.provider && (
                    <span className="rounded-full border border-white/[0.10] bg-white/[0.06]/80 px-2 py-0.5 text-[10px] font-semibold text-white/40">
                      {currentBonus.provider}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/30">
                  Game {progress} / {total}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={goBackBonus}
                disabled={currentOpeningIndex === 0}
                className="flex size-8 items-center justify-center rounded-lg border border-white/[0.06] text-white/40 transition hover:border-[#5B8DEF]/30 hover:text-white disabled:opacity-30 disabled:hover:border-white/[0.06] disabled:hover:text-white/40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goForwardBonus}
                disabled={currentOpeningIndex === total - 1}
                className="flex size-8 items-center justify-center rounded-lg border border-white/[0.06] text-white/40 transition hover:border-[#5B8DEF]/30 hover:text-white disabled:opacity-30 disabled:hover:border-white/[0.06] disabled:hover:text-white/40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            onClick={copySlotName}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/40 transition hover:border-[#5B8DEF]/25 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Slot Name
          </button>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="betsize_input" className="text-xs font-semibold uppercase tracking-wide text-white/30">
                Bet Size (CAD)
              </Label>
              <Input
                id="betsize_input"
                type="number"
                step="0.01"
                value={currentBonus.bet_size}
                disabled
                className="mt-1.5 h-11 rounded-xl border-white/[0.06] bg-[#0B0B0D] text-white disabled:opacity-70"
              />
            </div>

            <div>
              <Label htmlFor="payout_input" className="text-xs font-semibold uppercase tracking-wide text-white/30">
                Payout (CAD)
              </Label>
              <Input
                id="payout_input"
                type="number"
                step="0.01"
                value={payout}
                onChange={(e) => {
                  setPayout(e.target.value)
                  const payoutVal = Number.parseFloat(e.target.value)
                  if (!isNaN(payoutVal) && currentBonus.bet_size) {
                    setMultiplier((payoutVal / currentBonus.bet_size).toFixed(2))
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveAndNextOpening()
                  if (e.key === "Escape") exitOpeningMode()
                }}
                className="mt-1.5 h-11 rounded-xl border-white/[0.06] bg-[#0B0B0D] text-white focus-visible:ring-white/20"
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div>
              <Label
                htmlFor="multiplier_input"
                className="text-xs font-semibold uppercase tracking-wide text-white/30"
              >
                Multiplier
              </Label>
              <Input
                id="multiplier_input"
                type="number"
                step="0.01"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                className="mt-1.5 h-11 rounded-xl border-white/[0.06] bg-[#0B0B0D] text-white focus-visible:ring-white/20"
                placeholder="0.00x"
              />
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="notes_input" className="text-xs font-semibold uppercase tracking-wide text-white/30">
              Notes
            </Label>
            <Input
              id="notes_input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5 h-11 rounded-xl border-white/[0.06] bg-[#0B0B0D] text-white focus-visible:ring-white/20"
              placeholder="Type a note..."
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
            <Button
              onClick={exitOpeningMode}
              variant="outline"
              className="border-white/[0.10] bg-transparent text-white/60 hover:bg-white/[0.06] hover:text-white"
            >
              Cancel
            </Button>

            {nextBonus ? (
              <div className="flex items-center gap-2 text-sm text-white/30">
                <span>Next Game:</span>
                <span className="flex size-6 items-center justify-center overflow-hidden rounded-md border border-white/[0.06] bg-[#0B0B0D]">
                  {nextBonus.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                    <img
                      src={nextBonus.image_url || "/placeholder.svg"}
                      alt={nextBonus.game_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-3 w-3 text-white/20" />
                  )}
                </span>
                <span className="font-semibold text-white">{nextBonus.game_name}</span>
              </div>
            ) : (
              <span className="text-sm text-white/30">Last bonus in this hunt</span>
            )}

            <Button onClick={saveAndNextOpening} className="bg-[#5B8DEF] text-[#0B0B0D] hover:bg-[#4A7AD8]">
              Continue
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bonus grid */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/30">All Bonuses</h2>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8">
            {openingBonuses.map((bonus, index) => {
              const isOpened = bonus.result !== null
              const isCurrent = index === currentOpeningIndex

              return (
                <button
                  key={bonus.id}
                  onClick={() => selectBonusInOpening(index)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    isCurrent
                      ? "border-[#5B8DEF] bg-white/[0.06]"
                      : isOpened
                        ? "border-white/[0.06] bg-white/[0.022]"
                        : "border-white/[0.06] bg-[#0B0B0D]"
                  } hover:border-[#5B8DEF]/40`}
                >
                  {bonus.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                    <img
                      src={bonus.image_url || "/placeholder.svg"}
                      alt={bonus.game_name}
                      className={`h-full w-full object-cover ${isOpened ? "opacity-60" : ""}`}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-1.5">
                      <p className="line-clamp-2 text-center text-[10px] font-medium text-white">
                        {bonus.game_name}
                      </p>
                      <p className="text-[10px] text-white/30">${bonus.bet_size.toFixed(0)}</p>
                    </div>
                  )}

                  {bonus.is_super && (
                    <div className="absolute left-1 top-1">
                      <Crown className="h-3 w-3 text-amber-400 drop-shadow" />
                    </div>
                  )}
                  {isOpened && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                        ${bonus.result?.toFixed(0)}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
