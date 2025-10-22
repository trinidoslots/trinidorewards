"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { DollarSign, Gift } from "lucide-react"

type BonusHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
}

type DepositsWithdrawals = {
  id: string
  deposit_amount: number
  withdraw_amount: number
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bonusHunts, setBonusHunts] = useState<BonusHunt[]>([])
  const [startingBalance, setStartingBalance] = useState("")
  const [openingBalance, setOpeningBalance] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [totalGivenAway, setTotalGivenAway] = useState("")
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (bonusHunts.length > 0) {
      const firstHunt = bonusHunts[0]
      if (firstHunt) {
        if (firstHunt.starting_balance !== null && firstHunt.starting_balance !== undefined) {
          setStartingBalance(firstHunt.starting_balance.toString())
        }
        if (firstHunt.opening_balance !== null && firstHunt.opening_balance !== undefined) {
          setOpeningBalance(firstHunt.opening_balance.toString())
        }
      }
    }
  }, [bonusHunts])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
    } else {
      setUser(user)
      await fetchTotalGivenAway()
      await fetchDepositsWithdrawals()
      setLoading(false)
    }
  }

  async function fetchBonusHunts() {
    const { data, error } = await supabase.from("bonus_hunts").select("*").order("created_at", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching bonus hunts:", error)
    } else {
      const hunts = (data || []) as BonusHunt[]
      const filtered = hunts.filter((h) => h.game_name !== "_temp_balance_holder")
      setBonusHunts(filtered)
    }
  }

  async function fetchDepositsWithdrawals() {
    const { data, error } = await supabase.from("deposits_withdrawals").select("*").limit(1).single()

    if (error) {
      console.error("[v0] Error fetching deposits/withdrawals:", error)
    } else if (data) {
      setDepositAmount(data.deposit_amount?.toString() || "0")
      setWithdrawAmount(data.withdraw_amount?.toString() || "0")
    }
  }

  async function fetchTotalGivenAway() {
    const { data, error } = await supabase.from("settings").select("*").eq("key", "total_given_away").maybeSingle()

    if (error) {
      console.error("[v0] Error fetching total given away:", error)
    } else if (data) {
      setTotalGivenAway(data.value || "0")
    }
  }

  async function handleUpdateBalances(e: React.FormEvent) {
    e.preventDefault()

    const startBalance = Number.parseFloat(startingBalance)
    const openBalance = Number.parseFloat(openingBalance)

    if (bonusHunts.length === 0) {
      const { data: existingHolder } = await supabase
        .from("bonus_hunts")
        .select("*")
        .eq("game_name", "_temp_balance_holder")
        .single()

      if (existingHolder) {
        const { error } = await supabase
          .from("bonus_hunts")
          .update({ starting_balance: startBalance, opening_balance: openBalance })
          .eq("game_name", "_temp_balance_holder")

        if (error) {
          console.error("Error updating balance holder:", error)
          toast({
            title: "Error",
            description: "Failed to update balances",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Success",
            description: "Balances updated successfully",
            className: "bg-green-600 text-white",
          })
          fetchBonusHunts()
        }
      } else {
        const { error } = await supabase.from("bonus_hunts").insert([
          {
            game_name: "_temp_balance_holder",
            provider: null,
            bet_size: 0,
            result: 0,
            starting_balance: startBalance,
            opening_balance: openBalance,
          },
        ])

        if (error) {
          console.error("Error creating balance holder:", error)
          toast({
            title: "Error",
            description: "Failed to update balances",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Success",
            description: "Balances updated successfully",
            className: "bg-green-600 text-white",
          })
          fetchBonusHunts()
        }
      }
      return
    }

    const { error } = await supabase
      .from("bonus_hunts")
      .update({ starting_balance: startBalance, opening_balance: openBalance })
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (error) {
      console.error("Error updating balances:", error)
      toast({
        title: "Error",
        description: "Failed to update balances",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Balances updated successfully",
        className: "bg-green-600 text-white",
      })
      fetchBonusHunts()
    }
  }

  async function handleUpdateDepositsWithdrawals(e: React.FormEvent) {
    e.preventDefault()

    const deposit = Number.parseFloat(depositAmount)
    const withdraw = Number.parseFloat(withdrawAmount)

    const { data: existing } = await supabase.from("deposits_withdrawals").select("*").limit(1).single()

    if (existing) {
      const { error } = await supabase
        .from("deposits_withdrawals")
        .update({
          deposit_amount: deposit,
          withdraw_amount: withdraw,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) {
        console.error("[v0] Error updating deposits/withdrawals:", error)
        toast({
          title: "Error",
          description: "Failed to update deposits/withdrawals",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Deposits/Withdrawals updated successfully",
          className: "bg-green-600 text-white",
        })
      }
    } else {
      const { error } = await supabase.from("deposits_withdrawals").insert([
        {
          deposit_amount: deposit,
          withdraw_amount: withdraw,
        },
      ])

      if (error) {
        console.error("[v0] Error creating deposits/withdrawals:", error)
        toast({
          title: "Error",
          description: "Failed to create deposits/withdrawals",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Deposits/Withdrawals created successfully",
          className: "bg-green-600 text-white",
        })
        fetchDepositsWithdrawals()
      }
    }
  }

  async function handleUpdateTotalGivenAway(e: React.FormEvent) {
    e.preventDefault()

    const { data: existing } = await supabase.from("settings").select("*").eq("key", "total_given_away").maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({
          value: totalGivenAway,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "total_given_away")

      if (error) {
        console.error("[v0] Error updating total given away:", error)
        toast({
          title: "Error",
          description: "Failed to update total given away",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Total given away updated successfully",
          className: "bg-green-600 text-white",
        })
      }
    } else {
      const { error } = await supabase.from("settings").insert([
        {
          key: "total_given_away",
          value: totalGivenAway,
        },
      ])

      if (error) {
        console.error("[v0] Error creating total given away:", error)
        toast({
          title: "Error",
          description: "Failed to create total given away",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "Total given away created successfully",
          className: "bg-green-600 text-white",
        })
        fetchTotalGivenAway()
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-white text-xs">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
          <CardHeader className="p-3">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Gift className="w-4 h-4" />
              Total Given Away
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <form onSubmit={handleUpdateTotalGivenAway} className="space-y-3">
              <div>
                <Label htmlFor="total_given_away" className="text-slate-300 text-xs">
                  Total Amount Given Away ($)
                </Label>
                <p className="text-[10px] text-slate-400 mb-1">
                  The total amount given away to the community (shown on main page).
                </p>
                <Input
                  id="total_given_away"
                  type="number"
                  step="1"
                  value={totalGivenAway}
                  onChange={(e) => setTotalGivenAway(e.target.value)}
                  required
                  className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                  placeholder="0"
                />
              </div>

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                Update Total Given Away
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
          <CardHeader className="p-3">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4" />
              Deposits & Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <form onSubmit={handleUpdateDepositsWithdrawals} className="space-y-3">
              <div>
                <Label htmlFor="deposit_amount" className="text-slate-300 text-xs">
                  Deposit Amount ($)
                </Label>
                <p className="text-[10px] text-slate-400 mb-1">
                  The total amount deposited (shown in red on OBS widget).
                </p>
                <Input
                  id="deposit_amount"
                  type="number"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                  className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="withdraw_amount" className="text-slate-300 text-xs">
                  Withdraw Amount ($)
                </Label>
                <p className="text-[10px] text-slate-400 mb-1">
                  The total amount withdrawn (shown in green on OBS widget).
                </p>
                <Input
                  id="withdraw_amount"
                  type="number"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                  className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                  placeholder="0.00"
                />
              </div>

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                Update Deposits/Withdrawals
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
