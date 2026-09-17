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
import { DollarSign, Gift, Twitch } from "lucide-react"

type DepositsWithdrawals = {
  id: string
  deposit_amount: number
  withdraw_amount: number
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [depositAmount, setDepositAmount] = useState("")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [totalGivenAway, setTotalGivenAway] = useState("")
  const [kickMcpClientId, setKickMcpClientId] = useState("")
  const [kickMcpClientSecret, setKickMcpClientSecret] = useState("")
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
      await fetchTotalGivenAway()
      await fetchDepositsWithdrawals()
      await fetchKickSettings()
      setLoading(false)
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

  async function fetchKickSettings() {
    const keys = ["kickmcp_client_id", "kickmcp_client_secret"]

    for (const key of keys) {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("key", key)
        .maybeSingle()

      if (error) {
        console.error(`[v0] Error fetching ${key}:`, error)
        continue
      }

      if (data) {
        if (key === "kickmcp_client_id") setKickMcpClientId(data.value || "")
        if (key === "kickmcp_client_secret") setKickMcpClientSecret(data.value || "")
      }
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

  async function handleUpdateKickSettings(e: React.FormEvent) {
    e.preventDefault()

    const updates = [
      { key: "kickmcp_client_id", value: kickMcpClientId },
      { key: "kickmcp_client_secret", value: kickMcpClientSecret },
    ]

    for (const update of updates) {
      const { data: existing } = await supabase.from("settings").select("*").eq("key", update.key).maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from("settings")
          .update({
            value: update.value,
            updated_at: new Date().toISOString(),
          })
          .eq("key", update.key)

        if (error) {
          console.error("[v0] Error updating KickMCP setting:", error)
        }
      } else {
        const { error } = await supabase.from("settings").insert([{ key: update.key, value: update.value }])

        if (error) {
          console.error("[v0] Error creating KickMCP setting:", error)
        }
      }
    }

    toast({
      title: "Success",
      description: "KickMCP settings updated successfully",
      className: "bg-green-600 text-white",
    })
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
              <Twitch className="w-4 h-4" />
              KickMCP Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <form onSubmit={handleUpdateKickSettings} className="space-y-3">
              <div>
                <Label htmlFor="kickmcp_client_id" className="text-slate-300 text-xs">
                  Client ID
                </Label>
                <p className="text-[10px] text-slate-400 mb-1">Your KickMCP Client ID from Kick Developer Settings</p>
                <Input
                  id="kickmcp_client_id"
                  type="text"
                  value={kickMcpClientId}
                  onChange={(e) => setKickMcpClientId(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                  placeholder="Your KickMCP Client ID"
                />
              </div>

              <div>
                <Label htmlFor="kickmcp_client_secret" className="text-slate-300 text-xs">
                  Client Secret
                </Label>
                <p className="text-[10px] text-slate-400 mb-1">Your KickMCP Client Secret from Kick Developer Settings</p>
                <Input
                  id="kickmcp_client_secret"
                  type="password"
                  value={kickMcpClientSecret}
                  onChange={(e) => setKickMcpClientSecret(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white h-8 text-xs font-mono text-[10px]"
                  placeholder="Your KickMCP Client Secret"
                />
              </div>

              <div className="bg-cyan-900/20 border border-cyan-600/30 rounded p-2">
                <p className="text-[10px] text-cyan-300">
                  <strong>How to get credentials:</strong> Log into your Kick Developer account, create or select an application, and copy the Client ID and Client Secret from the OAuth credentials section.
                </p>
              </div>

              <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 h-8 text-xs">
                Update KickMCP Settings
              </Button>
            </form>
          </CardContent>
        </Card>

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
