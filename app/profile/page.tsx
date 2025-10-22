"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { User, Package, Plus, Trash2, Coins } from "lucide-react"
import { PageTransition } from "@/components/page-transition"

type Redemption = {
  id: string
  item_name: string
  cost: number
  status: string
  created_at: string
}

type SiteUsername = {
  id: string
  site_name: string
  username: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [siteUsernames, setSiteUsernames] = useState<SiteUsername[]>([])
  const [loading, setLoading] = useState(true)
  const [newSite, setNewSite] = useState("")
  const [newUsername, setNewUsername] = useState("")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchUserData()
  }, [])

  async function fetchUserData() {
    try {
      // Get user from cookies
      const response = await fetch("/api/auth/session")
      const sessionData = await response.json()

      console.log("[v0] Session data:", sessionData)

      if (!sessionData.user) {
        window.location.href = "/"
        return
      }

      setUser(sessionData.user)

      // Fetch redemptions
      const { data: redemptionsData, error: redemptionsError } = await supabase
        .from("redemptions")
        .select("*")
        .eq("user_id", sessionData.user.id)
        .order("created_at", { ascending: false })

      if (redemptionsError) {
        console.error("[v0] Error fetching redemptions:", redemptionsError)
      }

      setRedemptions((redemptionsData || []) as Redemption[])

      // Fetch site usernames
      const { data: usernamesData, error: usernamesError } = await supabase
        .from("user_site_usernames")
        .select("*")
        .eq("user_id", sessionData.user.id)
        .order("site_name", { ascending: true })

      if (usernamesError) {
        console.error("[v0] Error fetching usernames:", usernamesError)
      }

      setSiteUsernames((usernamesData || []) as SiteUsername[])
    } catch (error) {
      console.error("[v0] Error fetching user data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSiteUsername(e: React.FormEvent) {
    e.preventDefault()

    if (!user || !newSite || !newUsername) return

    const { error } = await supabase.from("user_site_usernames").insert({
      user_id: user.id,
      site_name: newSite,
      username: newUsername,
    })

    if (error) {
      console.error("[v0] Error adding username:", error)
      toast({
        title: "Error",
        description: "Failed to add username",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Username added successfully",
        className: "bg-green-600 text-white",
      })
      setNewSite("")
      setNewUsername("")
      fetchUserData()
    }
  }

  async function handleDeleteSiteUsername(id: string) {
    const { error } = await supabase.from("user_site_usernames").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting username:", error)
      toast({
        title: "Error",
        description: "Failed to delete username",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Username deleted successfully",
        className: "bg-green-600 text-white",
      })
      fetchUserData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            {user.avatar_url ? (
              <img src={user.avatar_url || "/placeholder.svg"} alt={user.username} className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{user.username}</h1>
              <div className="flex items-center gap-2 text-cyan-400">
                <Coins className="w-4 h-4" />
                <span className="font-semibold">{user.points_balance} Points</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Site Usernames */}
            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardHeader className="p-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Site Usernames
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <form onSubmit={handleAddSiteUsername} className="space-y-3">
                  <div>
                    <Label htmlFor="site" className="text-slate-300 text-sm">
                      Site Name
                    </Label>
                    <Input
                      id="site"
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      placeholder="e.g., Twitch, Discord, Steam"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="username" className="text-slate-300 text-sm">
                      Username
                    </Label>
                    <Input
                      id="username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Your username on that site"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Username
                  </Button>
                </form>

                <div className="space-y-2">
                  {siteUsernames.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">No usernames added yet</p>
                  ) : (
                    siteUsernames.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700"
                      >
                        <div>
                          <p className="text-white font-medium text-sm">{item.site_name}</p>
                          <p className="text-slate-400 text-xs">{item.username}</p>
                        </div>
                        <Button
                          onClick={() => handleDeleteSiteUsername(item.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-slate-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Redemption History */}
            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardHeader className="p-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Redemption History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {redemptions.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No redemptions yet</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {redemptions.map((redemption) => (
                      <div key={redemption.id} className="p-3 bg-slate-800/50 rounded border border-slate-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-medium text-sm">{redemption.item_name}</p>
                            <p className="text-slate-400 text-xs">
                              {new Date(redemption.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-cyan-400 font-semibold text-sm">{redemption.cost} points</p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                redemption.status === "completed"
                                  ? "bg-green-600 text-white"
                                  : "bg-yellow-600 text-white"
                              }`}
                            >
                              {redemption.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
