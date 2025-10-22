"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, ChevronRight, Copy, Check } from "lucide-react"

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

export default function OpeningModePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [openingBonuses, setOpeningBonuses] = useState<BonusHunt[]>([])
  const [currentOpeningIndex, setCurrentOpeningIndex] = useState(0)
  const [payout, setPayout] = useState("")
  const [multiplier, setMultiplier] = useState("")
  const [spinsUsed, setSpinsUsed] = useState("")
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [huntName, setHuntName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
    } else {
      setUser(user)
      await startOpeningMode()
      setLoading(false)
    }
  }

  async function startOpeningMode() {
    const { data, error } = await supabase.from("bonus_hunts").select("*").order("created_at", { ascending: true })

    if (error || !data) {
      console.error("[v0] Error fetching bonus hunts:", error)
      toast({
        title: "Error",
        description: "Failed to fetch bonus hunts",
        variant: "destructive",
      })
      return
    }

    const allBonuses = data.filter((hunt) => hunt.game_name !== "_temp_balance_holder")

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
    setSpinsUsed("")

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

    const { error } = await supabase.from("bonus_hunts").update({ result }).eq("id", currentBonus.id)
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
      setSpinsUsed("")

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
    setCurrentOpeningIndex(index)
    const bonus = openingBonuses[index]
    setPayout(bonus.result?.toString() || "")
    setMultiplier(bonus.result && bonus.bet_size ? (bonus.result / bonus.bet_size).toFixed(2) : "")
    setSpinsUsed("")

    setTimeout(() => {
      const input = document.getElementById("payout_input")
      if (input) input.focus()
    }, 50)
  }

  function goBackBonus() {
    if (currentOpeningIndex > 0) {
      selectBonusInOpening(currentOpeningIndex - 1)
    }
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

  async function saveHuntToPreviousHunts() {
    if (!huntName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a hunt name",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      const huntId = openingBonuses[0]?.hunt_id || "unknown"
      const startingBalance = openingBonuses[0]?.starting_balance || 0
      const openingBalance = openingBonuses[0]?.opening_balance || 0

      const totalBonuses = openingBonuses.length
      const totalBetSize = openingBonuses.reduce((sum, b) => sum + Number(b.bet_size), 0)
      const totalResult = openingBonuses.reduce((sum, b) => sum + (Number(b.result) || 0), 0)
      const profitLoss = totalResult - startingBalance

      const bonusesData = openingBonuses.map((b) => ({
        id: b.id,
        game_name: b.game_name,
        provider: b.provider,
        bet_size: b.bet_size,
        result: b.result,
        starting_balance: b.starting_balance,
        opening_balance: b.opening_balance,
        created_at: b.created_at,
      }))

      const { error } = await supabase.from("past_bonushunts").insert({
        hunt_id: huntId,
        hunt_name: huntName.trim(),
        starting_balance: startingBalance,
        opening_balance: openingBalance,
        total_bonuses: totalBonuses,
        total_bet_size: totalBetSize,
        total_result: totalResult,
        profit_loss: profitLoss,
        bonuses: JSON.stringify(bonusesData),
        status: "completed",
      })

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
          description: "Hunt saved to previous hunts!",
          className: "bg-green-600 text-white",
        })
        setShowSaveModal(false)
        setHuntName("")
      }
    } catch (error) {
      console.error("[v0] Error saving hunt:", error)
      toast({
        title: "Error",
        description: "Failed to save hunt",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function resetHunt() {
    if (!confirm("Are you sure you want to reset this hunt? This will delete all bonuses and cannot be undone.")) {
      return
    }

    try {
      const huntId = openingBonuses[0]?.hunt_id

      // Delete all bonus hunts for this hunt_id
      const { error: deleteError } = await supabase.from("bonus_hunts").delete().eq("hunt_id", huntId)

      if (deleteError) {
        console.error("[v0] Error deleting bonuses:", deleteError)
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

      // Redirect to users page
      router.push("/admin/users")
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (openingBonuses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-white text-2xl font-bold mb-4">No Bonuses to Open</h2>
          <p className="text-slate-400 mb-6">Add bonuses to your hunt first</p>
          <Button onClick={() => router.push("/admin/bonushunt")} className="bg-cyan-600 hover:bg-cyan-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
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
  const startingBalanceVal = openingBonuses[0]?.starting_balance || 0
  const totalWon = openedBonuses.reduce((sum, b) => sum + (Number(b.result) || 0), 0)
  const profitLoss = totalWon - startingBalanceVal
  const winRate = startingBalanceVal > 0 ? (totalWon / startingBalanceVal) * 100 : 0

  const remainingToOpen = openingBonuses.filter((b) => b.result === null)
  const remainingBetSize = remainingToOpen.reduce((sum, b) => sum + Number(b.bet_size), 0)
  const breakEvenX = remainingBetSize > 0 ? (startingBalanceVal - totalWon) / remainingBetSize : 0

  let highestMultiplier = 0
  let highestWin = { amount: 0, game: "", multiplier: 0 }

  openedBonuses.forEach((bonus) => {
    const mult = bonus.result && bonus.bet_size ? bonus.result / bonus.bet_size : 0
    if (mult > highestMultiplier) {
      highestMultiplier = mult
    }
    if (bonus.result && bonus.result > highestWin.amount) {
      highestWin = {
        amount: bonus.result,
        game: bonus.game_name,
        multiplier: mult,
      }
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Opening Mode</h1>
          <div className="flex gap-3">
            <Button onClick={() => setShowSaveModal(true)} className="bg-green-600 hover:bg-green-700 text-white">
              Save to Previous Hunts
            </Button>
            <Button onClick={resetHunt} variant="destructive" className="bg-red-600 hover:bg-red-700 text-white">
              Reset Hunt
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <Card className="bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">START</p>
              <p className="text-white text-xl font-bold">${startingBalanceVal.toFixed(0)}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">TOTAL WON</p>
              <p className="text-white text-xl font-bold">${totalWon.toFixed(0)}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">PROFIT/LOSS</p>
              <p className={`text-xl font-bold ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                ${profitLoss.toFixed(0)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">WIN RATE</p>
              <p className="text-white text-xl font-bold">{winRate.toFixed(1)}%</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardContent className="p-3">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">BREAK EVEN</p>
              <p className="text-white text-xl font-bold">{breakEvenX.toFixed(1)}x</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 border-slate-700 backdrop-blur md:col-span-3">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">HIGHEST MULTIPLIER</p>
                  <p className="text-white text-xl font-bold">{highestMultiplier.toFixed(1)}x</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">HIGHEST WIN</p>
                  <p className="text-amber-400 text-base font-medium">{highestWin.game || "N/A"}</p>
                  <p className="text-amber-400 text-lg font-bold">
                    ${highestWin.amount.toFixed(0)}
                    {highestWin.multiplier > 0 && (
                      <span className="text-base"> ({highestWin.multiplier.toFixed(1)}x)</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Input form */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">
                  {currentBonus.game_name} ({progress} / {total})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => copySlotName()}
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Slot Name
                </Button>

                <div>
                  <Label htmlFor="payout_input" className="text-slate-300">
                    Payout
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
                    className="bg-slate-900 border-slate-700 text-white h-12"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="multiplier_input" className="text-slate-300">
                    Multiplier
                  </Label>
                  <Input
                    id="multiplier_input"
                    type="number"
                    step="0.01"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white h-12"
                    placeholder="23"
                  />
                </div>

                <div>
                  <Label htmlFor="betsize_input" className="text-slate-300">
                    Betsize
                  </Label>
                  <Input
                    id="betsize_input"
                    type="number"
                    step="0.01"
                    value={currentBonus.bet_size}
                    disabled
                    className="bg-slate-900 border-slate-700 text-white h-12"
                  />
                </div>

                <div>
                  <Label htmlFor="spins_input" className="text-slate-300">
                    Spins used
                  </Label>
                  <Input
                    id="spins_input"
                    type="number"
                    value={spinsUsed}
                    onChange={(e) => setSpinsUsed(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white h-12"
                    placeholder="Spins used.."
                  />
                </div>

                <Button onClick={saveAndNextOpening} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white">
                  Save & continue <ChevronRight className="w-5 h-5 ml-2" />
                </Button>

                {currentOpeningIndex > 0 && (
                  <Button
                    onClick={goBackBonus}
                    variant="outline"
                    className="w-full h-12 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
                  </Button>
                )}

                <Button
                  onClick={exitOpeningMode}
                  variant="outline"
                  className="w-full h-12 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent"
                >
                  Exit Opening Mode
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right panel: Bonus grid */}
          <div className="lg:col-span-2">
            <h2 className="text-white text-xl font-semibold mb-4">Bonuses</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {openingBonuses.map((bonus, index) => {
                const isOpened = bonus.result !== null
                const isCurrent = index === currentOpeningIndex

                return (
                  <button
                    key={bonus.id}
                    onClick={() => selectBonusInOpening(index)}
                    className={`
                      relative aspect-square rounded-lg border-2 transition-all p-2
                      ${
                        isCurrent
                          ? "border-amber-500 bg-slate-700"
                          : isOpened
                            ? "border-slate-600 bg-slate-800/50"
                            : "border-slate-600 bg-slate-900/50"
                      }
                      hover:border-slate-500 hover:bg-slate-700/50
                    `}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-white text-xs font-medium text-center line-clamp-2 mb-1">{bonus.game_name}</p>
                      <p className="text-slate-400 text-xs">${bonus.bet_size.toFixed(0)}</p>
                      {isOpened && (
                        <div className="absolute top-1 right-1">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                      )}
                      {isOpened && (
                        <p className="text-green-400 text-xs font-semibold mt-1">${bonus.result?.toFixed(0)}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-900 border-slate-700 max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-white">Save Hunt to Previous Hunts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="hunt_name" className="text-slate-300">
                  Hunt Name
                </Label>
                <Input
                  id="hunt_name"
                  type="text"
                  value={huntName}
                  onChange={(e) => setHuntName(e.target.value)}
                  placeholder="Enter hunt name..."
                  className="bg-slate-800 border-slate-700 text-white"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={saveHuntToPreviousHunts}
                  disabled={isSaving}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSaving ? "Saving..." : "Save Hunt"}
                </Button>
                <Button
                  onClick={() => {
                    setShowSaveModal(false)
                    setHuntName("")
                  }}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white bg-transparent"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
