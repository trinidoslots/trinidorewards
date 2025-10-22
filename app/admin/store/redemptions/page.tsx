"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, Search, Check, X, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type Redemption = {
  id: string
  user_id: string
  item_id: string
  item_name: string
  cost: number
  status: string
  created_at: string
  user?: {
    username: string
    kick_id: string
  }
}

export default function StoreRedemptionsPage() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

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
      await fetchRedemptions()
      setLoading(false)
    }
  }

  async function fetchRedemptions() {
    console.log("[v0] Fetching redemptions...")

    // Try to fetch redemptions with user join
    const { data: redemptionsData, error: redemptionsError } = await supabase
      .from("redemptions")
      .select("*")
      .order("created_at", { ascending: false })

    if (redemptionsError) {
      console.error("[v0] Error fetching redemptions:", redemptionsError)
      console.error("[v0] Error details:", JSON.stringify(redemptionsError, null, 2))
      toast({
        title: "Error",
        description: `Failed to fetch redemptions: ${redemptionsError.message}`,
        variant: "destructive",
      })
      return
    }

    console.log("[v0] Redemptions fetched:", redemptionsData?.length || 0)

    // Fetch all users separately
    const { data: usersData, error: usersError } = await supabase.from("users").select("id, username, kick_id")

    if (usersError) {
      console.error("[v0] Error fetching users:", usersError)
      console.error("[v0] Error details:", JSON.stringify(usersError, null, 2))
    }

    console.log("[v0] Users fetched:", usersData?.length || 0)

    // Join redemptions with users client-side
    const redemptionsWithUsers = (redemptionsData || []).map((redemption: any) => {
      const user = usersData?.find((u) => u.id === redemption.user_id)
      return {
        ...redemption,
        user: user
          ? {
              username: user.username,
              kick_id: user.kick_id,
            }
          : undefined,
      }
    })

    console.log("[v0] Redemptions with users:", redemptionsWithUsers.length)
    setRedemptions(redemptionsWithUsers as Redemption[])
  }

  async function updateRedemptionStatus(id: string, status: string) {
    const { error } = await supabase.from("redemptions").update({ status }).eq("id", id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update redemption status",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: `Redemption marked as ${status}`,
      })
      await fetchRedemptions()
    }
  }

  const filteredRedemptions = redemptions.filter((redemption) => {
    const matchesSearch =
      redemption.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      redemption.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || redemption.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <Check className="w-4 h-4 text-green-500" />
      case "cancelled":
        return <X className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500"
      case "cancelled":
        return "text-red-500"
      default:
        return "text-yellow-500"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Store Redemptions</h1>
              <p className="text-slate-400">Manage user purchases and redemptions</p>
            </div>
            <Link href="/admin/store">
              <Button variant="outline" className="bg-transparent border-slate-600 hover:bg-slate-800 text-white">
                Back to Store
              </Button>
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white pl-10 h-10"
              placeholder="Search by item or user..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white rounded-md h-10 px-3"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="flex-1"></div>
          <Button
            onClick={fetchRedemptions}
            variant="outline"
            className="bg-transparent border-slate-600 hover:bg-slate-800 text-white h-10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            REFRESH
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Total Redemptions</p>
            <p className="text-2xl font-bold text-white">{redemptions.length}</p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-500">
              {redemptions.filter((r) => r.status === "pending").length}
            </p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-500">
              {redemptions.filter((r) => r.status === "completed").length}
            </p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm mb-1">Total Points Spent</p>
            <p className="text-2xl font-bold text-white">
              {redemptions.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left p-4 text-slate-400 font-semibold text-sm uppercase tracking-wider">USER</th>
                <th className="text-left p-4 text-slate-400 font-semibold text-sm uppercase tracking-wider">ITEM</th>
                <th className="text-left p-4 text-slate-400 font-semibold text-sm uppercase tracking-wider">COST</th>
                <th className="text-left p-4 text-slate-400 font-semibold text-sm uppercase tracking-wider">STATUS</th>
                <th className="text-left p-4 text-slate-400 font-semibold text-sm uppercase tracking-wider">DATE</th>
                <th className="text-left p-4 text-slate-400 font-semibold text-sm uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRedemptions.map((redemption) => (
                <tr key={redemption.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{redemption.user?.username || "Unknown"}</span>
                      <span className="text-slate-500 text-xs">ID: {redemption.user?.kick_id || "N/A"}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-white">{redemption.item_name}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-white font-mono">{redemption.cost.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(redemption.status)}
                      <span className={`capitalize ${getStatusColor(redemption.status)}`}>{redemption.status}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-slate-400 text-sm">
                      {new Date(redemption.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {redemption.status === "pending" && (
                        <>
                          <Button
                            onClick={() => updateRedemptionStatus(redemption.id, "completed")}
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => updateRedemptionStatus(redemption.id, "cancelled")}
                            size="sm"
                            variant="destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {redemption.status !== "pending" && (
                        <Button
                          onClick={() => updateRedemptionStatus(redemption.id, "pending")}
                          size="sm"
                          variant="outline"
                          className="bg-transparent border-slate-600 hover:bg-slate-800 text-white"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRedemptions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">No redemptions found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
