"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Trophy, Users, DollarSign, RefreshCw, Trash2 } from "lucide-react"
import { calculateLeaderboardStatus, getStatusBadgeClass } from "@/lib/leaderboard-utils"
import Link from "next/link"

type Leaderboard = {
  id: string
  title: string
  subtitle: string | null
  prize_pool: number
  start_date: string
  end_date: string
  status: string
  created_at: string
  prize_distribution_type: string
}

type LeaderboardWithEntries = Leaderboard & {
  entry_count: number
  calculated_status: "upcoming" | "active" | "ended"
}

export default function LeaderboardsOverviewPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [leaderboards, setLeaderboards] = useState<LeaderboardWithEntries[]>([])
  const [filteredLeaderboards, setFilteredLeaderboards] = useState<LeaderboardWithEntries[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    filterLeaderboards()
  }, [leaderboards, searchQuery, statusFilter])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
    } else {
      setUser(user)
      await fetchLeaderboards()
      setLoading(false)
    }
  }

  async function fetchLeaderboards() {
    // Fetch leaderboards
    const { data: leaderboardsData, error: lbError } = await supabase
      .from("leaderboards")
      .select("*")
      .order("created_at", { ascending: false })

    if (lbError) {
      console.error("[v0] Error fetching leaderboards:", lbError)
      return
    }

    // Fetch entry counts for each leaderboard
    const leaderboardsWithCounts = await Promise.all(
      (leaderboardsData || []).map(async (lb) => {
        const { count } = await supabase
          .from("leaderboard_entries")
          .select("*", { count: "exact", head: true })
          .eq("leaderboard_id", lb.id)

        return {
          ...lb,
          entry_count: count || 0,
          calculated_status: calculateLeaderboardStatus(lb.start_date, lb.end_date),
        }
      }),
    )

    setLeaderboards(leaderboardsWithCounts)
  }

  function filterLeaderboards() {
    let filtered = [...leaderboards]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (lb) =>
          lb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lb.id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((lb) => lb.calculated_status === statusFilter)
    }

    setFilteredLeaderboards(filtered)
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this leaderboard?")) return

    const { error } = await supabase.from("leaderboards").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting leaderboard:", error)
      toast({
        title: "Error",
        description: "Failed to delete leaderboard",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Leaderboard deleted successfully",
        className: "bg-green-600 text-white",
      })
      fetchLeaderboards()
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredLeaderboards.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeaderboards.map((lb) => lb.id)))
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // Calculate statistics
  const totalLeaderboards = leaderboards.length
  const totalEntries = leaderboards.reduce((sum, lb) => sum + lb.entry_count, 0)
  const totalPrize = leaderboards.reduce((sum, lb) => sum + lb.prize_pool, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-white text-xs">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs mb-1">Total Leaderboards</p>
                <p className="text-white text-3xl font-bold">{totalLeaderboards}</p>
              </div>
              <div className="bg-cyan-500/20 p-3 rounded-lg">
                <Trophy className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs mb-1">Total Entries</p>
                <p className="text-white text-3xl font-bold">{totalEntries.toLocaleString()}</p>
              </div>
              <div className="bg-amber-500/20 p-3 rounded-lg">
                <Users className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs mb-1">Total Entries Prize</p>
                <p className="text-white text-3xl font-bold">${totalPrize.toLocaleString()}</p>
              </div>
              <div className="bg-red-500/20 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
        <CardContent className="p-6">
          <h2 className="text-white text-lg font-semibold mb-4">Search & Filter</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="ended">Ended</option>
            </select>

            <div className="md:col-span-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or ID..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => fetchLeaderboards()} size="sm" className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboards Table */}
      <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">Leaderboards</h2>
            <Link href="/admin/leaderboards/manage">
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700">
                Manage Leaderboards
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredLeaderboards.length && filteredLeaderboards.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">ID</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Name</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Entries</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Prize</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Created</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Ends At</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboards.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500 text-sm">
                      No leaderboards found
                    </td>
                  </tr>
                ) : (
                  filteredLeaderboards.map((lb) => (
                    <tr key={lb.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lb.id)}
                          onChange={() => toggleSelect(lb.id)}
                          className="rounded border-slate-600 bg-slate-800"
                        />
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs font-mono">{lb.id.substring(0, 8)}...</td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white text-sm font-medium">{lb.title}</p>
                          {lb.subtitle && <p className="text-slate-500 text-xs">{lb.subtitle}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-400 text-sm capitalize">{lb.prize_distribution_type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClass(lb.calculated_status)}`}
                        >
                          {lb.calculated_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white text-sm">{lb.entry_count}</td>
                      <td className="py-3 px-4 text-amber-400 text-sm font-medium">
                        ${lb.prize_pool.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {new Date(lb.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{new Date(lb.end_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <Button
                          onClick={() => handleDelete(lb.id)}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
