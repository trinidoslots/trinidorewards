"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Lock, Check, Gift, Clock, Sparkles } from "lucide-react"
import { RewardRollAnimation } from "./reward-roll-animation"

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
}

interface AdventClaim {
  day_number: number
  claimed_at: string
  reward_title?: string
  reward_icon?: string
}

interface Props {
  rewardsByDay: Record<number, AdventReward[]>
  claims: AdventClaim[]
  userId: string | null
  username: string | null
}

export function AdventCalendarClient({ rewardsByDay, claims, userId, username }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [claimedDays, setClaimedDays] = useState<Map<number, AdventClaim>>(
    new Map(claims.map((c) => [c.day_number, c])),
  )
  const [timeUntilNext, setTimeUntilNext] = useState("")
  const [isRolling, setIsRolling] = useState(false)
  const [rollingRewards, setRollingRewards] = useState<AdventReward[]>([])
  const [wonReward, setWonReward] = useState<AdventReward | null>(null)
  const { toast } = useToast()
  const supabase = createBrowserClient()

  // Get current date info
  const now = new Date()
  const currentMonth = now.getMonth() // 0-11 (December = 11)
  const currentDay = now.getDate() // 1-31
  const currentYear = now.getFullYear()
  const isDecember = currentMonth === 11

  // Calculate time until next claimable day
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)

      const diff = tomorrow.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeUntilNext(`${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [])

  const getDayStatus = (dayNumber: number) => {
    if (!isDecember) return "locked"
    if (claimedDays.has(dayNumber)) return "claimed"
    if (dayNumber === currentDay) return "available"
    if (dayNumber < currentDay) return "missed"
    return "locked"
  }

  const handleDayClick = (dayNumber: number) => {
    const status = getDayStatus(dayNumber)

    if (status === "locked") {
      toast({
        title: "Locked",
        description: `This reward will be available on December ${dayNumber}`,
        className: "bg-slate-800 text-white border-slate-700",
      })
      return
    }

    setSelectedDay(dayNumber)
  }


  const handleClaimReward = async () => {
    if (!userId || !username || selectedDay === null) {
      toast({
        title: "Login Required",
        description: "Please login to claim rewards",
        variant: "destructive",
      })
      return
    }

    const status = getDayStatus(selectedDay)

    if (status !== "available") {
      toast({
        title: "Cannot Claim",
        description: status === "claimed" ? "You've already claimed this reward" : "This reward is no longer available",
        variant: "destructive",
      })
      return
    }

    const dayRewards = rewardsByDay[selectedDay] || []
    if (dayRewards.length === 0) return

    // The server rolls the reward and records the claim (/api/advent/claim);
    // this only plays the animation for what it decided. Rolling here and
    // writing the result from the browser let anyone pick their own prize.
    try {
      const response = await fetch("/api/advent/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_number: selectedDay }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || "Failed to claim reward")

      const won = dayRewards.find((reward) => reward.id === payload.reward?.id) ?? (payload.reward as AdventReward)
      setRollingRewards(dayRewards)
      setWonReward(won)
      setIsRolling(true)
      setSelectedDay(null)
    } catch (error: any) {
      toast({
        title: "Cannot Claim",
        description: error.message || "Failed to claim reward",
        variant: "destructive",
      })
    }
  }

  const handleRollComplete = async () => {
    if (!wonReward || !userId || !username) return

    // Already recorded by the server before the animation started.
    try {
      setClaimedDays(
        (prev) =>
          new Map([
            ...prev,
            [
              wonReward.day_number,
              {
                day_number: wonReward.day_number,
                claimed_at: new Date().toISOString(),
                reward_title: wonReward.title,
                reward_icon: wonReward.icon,
              },
            ],
          ]),
      )

      toast({
        title: "Reward Claimed!",
        description: `You've won: ${wonReward.title}`,
        className: "bg-green-600 text-white",
      })

      setIsRolling(false)
      setWonReward(null)
      setRollingRewards([])
    } catch (error: any) {
      console.error("[v0] Error claiming reward:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to claim reward",
        variant: "destructive",
      })
      setIsRolling(false)
    }
  }

  // Get the first reward for display purposes (or claimed reward)
  const getDisplayReward = (dayNumber: number) => {
    const claim = claimedDays.get(dayNumber)
    if (claim) {
      return {
        icon: claim.reward_icon || "🎁",
        title: claim.reward_title || "Claimed",
      }
    }
    const rewards = rewardsByDay[dayNumber] || []
    return rewards[0] || { icon: "🎁", title: "Mystery" }
  }

  return (
    <>
      {isRolling && wonReward && (
        <RewardRollAnimation rewards={rollingRewards} wonReward={wonReward} onComplete={handleRollComplete} />
      )}

      <div className="text-center mb-12 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-green-500/10 to-red-500/10 blur-3xl -z-10" />
        <p className="text-xl text-slate-300 font-medium">Unwrap a new surprise every day this December! 🎄</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 24 }, (_, i) => i + 1).map((dayNumber) => {
          const status = getDayStatus(dayNumber)
          const displayReward = getDisplayReward(dayNumber)

          return (
            <Card
              key={dayNumber}
              onClick={() => handleDayClick(dayNumber)}
              className={`
                aspect-square flex flex-col items-center justify-center cursor-pointer
                transition-all duration-500 relative overflow-hidden group
                border-2
                ${status === "locked" ? "opacity-60 cursor-not-allowed bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700" : ""}
                ${status === "claimed" ? "bg-gradient-to-br from-emerald-900/40 via-green-800/30 to-emerald-900/40 border-emerald-600/60 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : ""}
                ${status === "available" ? "bg-gradient-to-br from-red-900/40 via-yellow-600/20 to-green-900/40 border-yellow-500 hover:border-yellow-400 hover:scale-110 hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] hover:rotate-2" : ""}
                ${status === "missed" ? "bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 border-red-800/40" : ""}
              `}
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 left-2 text-2xl">❄️</div>
                <div className="absolute bottom-2 right-2 text-2xl">❄️</div>
              </div>

              {status === "locked" && (
                <div className="absolute top-3 right-3 bg-slate-800/80 rounded-full p-1.5">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
              )}
              {status === "claimed" && (
                <div className="absolute top-3 right-3 bg-emerald-600/80 rounded-full p-1.5 animate-bounce">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}

              <div
                className={`text-5xl font-black mb-2 relative z-10 ${
                  status === "available"
                    ? "text-yellow-400 animate-pulse"
                    : status === "claimed"
                      ? "text-emerald-400"
                      : status === "missed"
                        ? "text-red-400"
                        : "text-slate-500"
                }`}
              >
                {dayNumber}
              </div>

              {status === "available" && (
                <div className="absolute bottom-3 flex items-center gap-1 text-xs text-yellow-400 font-bold animate-pulse bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/50">
                  <Sparkles className="w-3 h-3" />
                  OPEN NOW
                </div>
              )}

              {status === "missed" && (
                <div className="absolute bottom-3 text-xs text-red-400 font-semibold bg-red-900/30 px-3 py-1 rounded-full border border-red-700/50">
                  MISSED
                </div>
              )}

              {status === "claimed" && (
                <div className="absolute bottom-3 text-xs text-emerald-400 font-semibold bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-700/50">
                  CLAIMED
                </div>
              )}

              {status === "available" && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-yellow-400 rounded-full animate-ping" />
                  <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-yellow-400 rounded-full animate-ping delay-75" />
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {isDecember && currentDay < 24 && (
        <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-500/50 p-8 text-center shadow-[0_0_30px_rgba(234,179,8,0.2)]">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: "3s" }} />
            <h3 className="text-white font-bold text-xl">Next Reward Unlocks In</h3>
            <Clock className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <p className="text-4xl font-black bg-gradient-to-r from-yellow-400 via-red-400 to-green-400 bg-clip-text text-transparent">
            {timeUntilNext}
          </p>
          <p className="text-slate-400 mt-2 text-sm">Come back tomorrow for another surprise! 🎁</p>
        </Card>
      )}

      <Dialog open={selectedDay !== null} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-500/50 text-white max-w-md shadow-[0_0_50px_rgba(234,179,8,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-center bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Gift className="w-8 h-8 text-yellow-400" />
              Day {selectedDay}
              <Gift className="w-8 h-8 text-yellow-400" />
            </DialogTitle>
          </DialogHeader>

          <div className="text-center py-8 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-yellow-500/5 to-green-500/5 rounded-lg" />

            {selectedDay && rewardsByDay[selectedDay] && (
              <>
                <h3 className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent mb-4 relative z-10">
                  Mystery Reward!
                </h3>
                <p className="text-slate-300 mb-6 text-lg relative z-10">
                  Click the button below to reveal your prize! ✨
                </p>

                {rewardsByDay[selectedDay].length > 1 && (
                  <div className="mb-8 text-sm text-slate-400 bg-slate-800/50 rounded-lg p-4 border border-slate-700 relative z-10">
                    <p className="mb-3 font-semibold text-slate-300">Possible Rewards:</p>
                    <div className="space-y-2">
                      {rewardsByDay[selectedDay].map((reward) => (
                        <div
                          key={reward.id}
                          className="flex items-center justify-between text-sm bg-slate-900/50 rounded px-3 py-2"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-2xl">{reward.icon}</span>
                            <span className="text-slate-200">{reward.title}</span>
                          </span>
                          <span className="text-yellow-400 font-bold">{reward.probability}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {getDayStatus(selectedDay) === "available" && (
                  <Button
                    onClick={handleClaimReward}
                    className="bg-gradient-to-r from-yellow-500 via-yellow-600 to-yellow-500 hover:from-yellow-600 hover:via-yellow-700 hover:to-yellow-600 text-slate-900 font-black text-xl px-10 py-7 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.5)] hover:shadow-[0_0_50px_rgba(234,179,8,0.7)] hover:scale-105 transition-all duration-300 relative z-10"
                  >
                    <Sparkles className="w-6 h-6 mr-2" />
                    Roll for Reward
                    <Sparkles className="w-6 h-6 ml-2" />
                  </Button>
                )}

                {getDayStatus(selectedDay) === "claimed" && (
                  <div className="text-emerald-400 font-bold text-xl flex items-center justify-center gap-3 bg-emerald-900/30 rounded-lg py-4 border border-emerald-700/50 relative z-10">
                    <Check className="w-6 h-6" />
                    Already Claimed Today!
                  </div>
                )}

                {getDayStatus(selectedDay) === "missed" && (
                  <div className="text-red-400 font-bold text-xl bg-red-900/30 rounded-lg py-4 border border-red-700/50 relative z-10">
                    😢 Sadly you have missed this one
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
