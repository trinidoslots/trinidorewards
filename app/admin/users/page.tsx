"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Search, Pencil, RefreshCw, Filter, X } from "lucide-react"
import { PageTransition } from "@/components/page-transition"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type User = {
  id: string
  username: string
  kick_id: string
  points_balance: number
  avatar_url: string | null
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("registered")
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pointsAction, setPointsAction] = useState<"add" | "remove" | "set">("add")
  const [pointsAmount, setPointsAmount] = useState("")
  const [actionError, setActionError] = useState("")
  const [amountError, setAmountError] = useState("")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, sortBy, users])

  async function fetchData() {
    setLoading(true)
    try {
      const { data: usersData, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        })
        return
      }

      const usersList = (usersData || []) as User[]
      setUsers(usersList)
      setFilteredUsers(usersList)
    } catch (error) {
      console.error("[v0] Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...users]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.kick_id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply sorting
    if (sortBy === "registered") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortBy === "points") {
      filtered.sort((a, b) => b.points_balance - a.points_balance)
    } else if (sortBy === "username") {
      filtered.sort((a, b) => a.username.localeCompare(b.username))
    }

    setFilteredUsers(filtered)
  }

  async function handleEditPoints() {
    // Reset errors
    setActionError("")
    setAmountError("")

    // Validate inputs
    let hasError = false
    if (!pointsAction) {
      setActionError("This field is required")
      hasError = true
    }
    if (!pointsAmount || Number.isNaN(Number.parseInt(pointsAmount))) {
      setAmountError("This field is required")
      hasError = true
    }

    if (hasError || !selectedUser) return

    const points = Number.parseInt(pointsAmount)
    if (points <= 0) {
      setAmountError("Points must be greater than 0")
      return
    }

    try {
      const endpoint =
        pointsAction === "add"
          ? "/api/kicklet/points/add"
          : pointsAction === "remove"
            ? "/api/kicklet/points/remove"
            : "/api/kicklet/points/set"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: selectedUser.username,
          points: points,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update points")
      }

      const actionText =
        pointsAction === "add"
          ? `added ${points} points to`
          : pointsAction === "remove"
            ? `removed ${points} points from`
            : `set ${selectedUser.username}'s points to ${points}`

      toast({
        title: "Success",
        description: `Successfully ${actionText}${pointsAction !== "set" ? ` ${selectedUser.username}` : ""}`,
        className: "bg-green-600 text-white",
      })

      // Close modal and refresh data
      setEditModalOpen(false)
      setSelectedUser(null)
      setPointsAction("add")
      setPointsAmount("")
      fetchData()
    } catch (error) {
      console.error("[v0] Error updating points:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update points",
        variant: "destructive",
      })
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
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-slate-400">Manage users, points, and view user activity</p>
        </div>

        {/* Search & Filter Section */}
        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Search & Filter
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="registered" className="text-white">
                    Registered Date
                  </SelectItem>
                  <SelectItem value="points" className="text-white">
                    Total Points
                  </SelectItem>
                  <SelectItem value="username" className="text-white">
                    Username
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username or Kick ID..."
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button onClick={fetchData} className="bg-slate-700 hover:bg-slate-600 text-white gap-2">
                <RefreshCw className="w-4 h-4" />
                REFRESH
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-700">
                  <tr className="text-left">
                    <th className="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">User</th>
                    <th className="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Kick ID</th>
                    <th className="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Earned</th>
                    <th className="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">
                      Registered {sortBy === "registered" && "↓"}
                    </th>
                    <th className="p-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url || "/placeholder.svg"}
                                alt={user.username}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="text-white font-medium">{user.username}</p>
                              <p className="text-slate-500 text-xs">{user.id.substring(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-slate-300 text-sm">{user.kick_id}</p>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setEditModalOpen(true)
                              setPointsAction("add")
                              setPointsAmount("")
                              setActionError("")
                              setAmountError("")
                            }}
                            className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors"
                          >
                            ${user.points_balance.toFixed(2)}
                          </button>
                        </td>
                        <td className="p-4">
                          <p className="text-slate-300 text-sm">
                            {new Date(user.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </td>
                        <td className="p-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-white hover:bg-slate-700"
                          >
                            <Pencil className="w-4 h-4" />
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

        {/* Stats Footer */}
        <div className="flex items-center justify-between text-sm text-slate-400">
          <p>
            Showing {filteredUsers.length} of {users.length} users
          </p>
          <p>Total Points Distributed: ${users.reduce((sum, u) => sum + u.points_balance, 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Edit Points Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-xl">
              Edit Points
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditModalOpen(false)}
                className="h-6 w-6 p-0 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Add or Remove Dropdown */}
            <div className="space-y-2">
              <Select
                value={pointsAction}
                onValueChange={(value: "add" | "remove" | "set") => {
                  setPointsAction(value)
                  setActionError("")
                }}
              >
                <SelectTrigger
                  className={`bg-slate-800 border-2 ${actionError ? "border-red-500" : "border-slate-700"} text-white h-12`}
                >
                  <SelectValue placeholder="Add or Remove" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="add" className="text-white">
                    Add Points
                  </SelectItem>
                  <SelectItem value="remove" className="text-white">
                    Remove Points
                  </SelectItem>
                  <SelectItem value="set" className="text-white">
                    Set Points (Manual Sync)
                  </SelectItem>
                </SelectContent>
              </Select>
              {actionError && <p className="text-red-500 text-sm">{actionError}</p>}
            </div>

            {/* Points Input */}
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Points"
                value={pointsAmount}
                onChange={(e) => {
                  setPointsAmount(e.target.value)
                  setAmountError("")
                }}
                className={`bg-slate-800 border-2 ${amountError ? "border-red-500" : "border-slate-700"} text-white h-12 placeholder:text-slate-500`}
              />
              {amountError && <p className="text-red-500 text-sm">{amountError}</p>}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleEditPoints}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white h-12 font-semibold"
              >
                EDIT
              </Button>
              <Button
                onClick={() => setEditModalOpen(false)}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800 h-12 font-semibold"
              >
                CANCEL
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
