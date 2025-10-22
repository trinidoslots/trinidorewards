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
import { Trophy, Plus, Trash2, Users, Upload, Download, Edit, Save, X, RefreshCw, ImageIcon } from "lucide-react"

type Leaderboard = {
  id: string
  title: string
  subtitle: string | null
  prize_pool: number
  prize_distribution_type: string
  api_url: string | null
  api_key: string | null
  image_url: string | null
  start_date: string
  end_date: string
  status: string
}

type LeaderboardEntry = {
  id: string
  leaderboard_id: string
  rank: number
  username: string
  wager_amount: number
  prize_amount: number
}

export default function LeaderboardsAdminPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([])
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<string | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [showCsvUpload, setShowCsvUpload] = useState(false)

  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [prizePool, setPrizePool] = useState("")
  const [prizeDistribution, setPrizeDistribution] = useState("classic")
  const [apiUrl, setApiUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [status, setStatus] = useState("active")

  const [entryUsername, setEntryUsername] = useState("")
  const [entryRank, setEntryRank] = useState("")
  const [entryWager, setEntryWager] = useState("")
  const [entryPrize, setEntryPrize] = useState("")

  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ username: "", wager_amount: "", prize_amount: "" })

  const [editingLeaderboard, setEditingLeaderboard] = useState<string | null>(null)
  const [editLeaderboardForm, setEditLeaderboardForm] = useState({
    title: "",
    subtitle: "",
    prize_pool: "",
    prize_distribution_type: "",
    api_url: "",
    api_key: "",
    image_url: "",
    start_date: "",
    end_date: "",
    status: "",
  })

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
      await fetchLeaderboards()
      setLoading(false)
    }
  }

  async function fetchLeaderboards() {
    const { data, error } = await supabase.from("leaderboards").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching leaderboards:", error)
    } else {
      setLeaderboards(data || [])
    }
  }

  async function fetchEntries(leaderboardId: string) {
    const { data, error } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("leaderboard_id", leaderboardId)
      .order("rank", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching entries:", error)
    } else {
      setEntries(data || [])
    }
  }

  async function handleCreateLeaderboard(e: React.FormEvent) {
    e.preventDefault()

    const { error } = await supabase.from("leaderboards").insert([
      {
        title,
        subtitle: subtitle || null,
        prize_pool: Number.parseFloat(prizePool),
        prize_distribution_type: prizeDistribution,
        api_url: apiUrl || null,
        api_key: apiKey || null,
        image_url: imageUrl || null,
        start_date: startDate,
        end_date: endDate,
        status,
      },
    ])

    if (error) {
      console.error("[v0] Error creating leaderboard:", error)
      toast({
        title: "Error",
        description: "Failed to create leaderboard",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Leaderboard created successfully",
        className: "bg-green-600 text-white",
      })
      setShowCreateForm(false)
      resetForm()
      fetchLeaderboards()
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedLeaderboard) return

    const { error } = await supabase.from("leaderboard_entries").insert([
      {
        leaderboard_id: selectedLeaderboard,
        rank: Number.parseInt(entryRank),
        username: entryUsername,
        wager_amount: Number.parseFloat(entryWager),
        prize_amount: Number.parseFloat(entryPrize),
      },
    ])

    if (error) {
      console.error("[v0] Error adding entry:", error)
      toast({
        title: "Error",
        description: "Failed to add entry",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Entry added successfully",
        className: "bg-green-600 text-white",
      })
      setShowEntryForm(false)
      resetEntryForm()
      fetchEntries(selectedLeaderboard)
    }
  }

  async function handleDeleteLeaderboard(id: string) {
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
      if (selectedLeaderboard === id) {
        setSelectedLeaderboard(null)
        setEntries([])
      }
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("Are you sure you want to delete this entry?")) return

    const { error } = await supabase.from("leaderboard_entries").delete().eq("id", id)

    if (error) {
      console.error("[v0] Error deleting entry:", error)
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Entry deleted successfully",
        className: "bg-green-600 text-white",
      })
      if (selectedLeaderboard) fetchEntries(selectedLeaderboard)
    }
  }

  function resetForm() {
    setTitle("")
    setSubtitle("")
    setPrizePool("")
    setPrizeDistribution("classic")
    setApiUrl("")
    setApiKey("")
    setImageUrl("")
    setStartDate("")
    setEndDate("")
    setStatus("active")
  }

  function resetEntryForm() {
    setEntryUsername("")
    setEntryRank("")
    setEntryWager("")
    setEntryPrize("")
  }

  function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
      parseCSV(file)
    }
  }

  function parseCSV(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split("\n").filter((line) => line.trim())
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

      const data = lines.slice(1).map((line, index) => {
        const values = line.split(",").map((v) => v.trim())
        const entry: any = {}

        headers.forEach((header, i) => {
          if (header === "username") entry.username = values[i]
          else if (header === "wager_amount" || header === "wager") entry.wager_amount = Number.parseFloat(values[i])
          // Removed rank and prize_amount from here as they will be calculated
        })

        return entry
      })

      setCsvPreview(data)
    }
    reader.readAsText(file)
  }

  function calculatePrizes(entries: any[], prizePool: number, distributionType: string) {
    const sorted = [...entries].sort((a, b) => b.wager_amount - a.wager_amount)

    let distribution: { [key: number]: number } = {}

    if (distributionType === "classic") {
      distribution = { 0: 0.5, 1: 0.25, 2: 0.15, 3: 0.07, 4: 0.03 }
    } else if (distributionType === "balanced") {
      distribution = { 0: 0.3, 1: 0.2, 2: 0.15, 3: 0.1, 4: 0.08 }
      // 6-10th place split 17% evenly
      for (let i = 5; i < 10; i++) {
        distribution[i] = 0.17 / 5
      }
    } else if (distributionType === "wide") {
      distribution = { 0: 0.15 }
      // 2-3rd split 15%
      distribution[1] = 0.075
      distribution[2] = 0.075
      // 4-10th split 20%
      for (let i = 3; i < 10; i++) {
        distribution[i] = 0.2 / 7
      }
      // 11-25th split 25%
      for (let i = 10; i < 25; i++) {
        distribution[i] = 0.25 / 15
      }
      // 26-50th split 25%
      for (let i = 25; i < 50; i++) {
        distribution[i] = 0.25 / 25
      }
    }

    return sorted.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      prize_amount: distribution[index] ? prizePool * distribution[index] : 0,
    }))
  }

  async function handleCsvUpload() {
    if (!selectedLeaderboard || csvPreview.length === 0) return

    const leaderboard = leaderboards.find((lb) => lb.id === selectedLeaderboard)
    if (!leaderboard) return

    const entriesWithPrizes = calculatePrizes(csvPreview, leaderboard.prize_pool, leaderboard.prize_distribution_type)

    const entries = entriesWithPrizes.map((entry) => ({
      leaderboard_id: selectedLeaderboard,
      rank: entry.rank,
      username: entry.username,
      wager_amount: entry.wager_amount,
      prize_amount: entry.prize_amount,
    }))

    const { error } = await supabase.from("leaderboard_entries").insert(entries)

    if (error) {
      console.error("[v0] Error uploading CSV entries:", error)
      toast({
        title: "Error",
        description: "Failed to upload entries",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: `${entries.length} entries uploaded successfully`,
        className: "bg-green-600 text-white",
      })
      setShowCsvUpload(false)
      setCsvFile(null)
      setCsvPreview([])
      fetchEntries(selectedLeaderboard)
    }
  }

  async function fetchFromApi() {
    if (!selectedLeaderboard) return

    const leaderboard = leaderboards.find((lb) => lb.id === selectedLeaderboard)
    if (!leaderboard?.api_url) {
      toast({
        title: "Error",
        description: "No API URL configured for this leaderboard",
        variant: "destructive",
      })
      return
    }

    try {
      const headers: any = { "Content-Type": "application/json" }
      if (leaderboard.api_key) {
        headers["Authorization"] = `Bearer ${leaderboard.api_key}`
      }

      const response = await fetch(leaderboard.api_url, { headers })
      const data = await response.json()

      // Assume API returns array of { username, wager_amount }
      const entriesWithPrizes = calculatePrizes(data, leaderboard.prize_pool, leaderboard.prize_distribution_type)

      const entries = entriesWithPrizes.map((entry) => ({
        leaderboard_id: selectedLeaderboard,
        rank: entry.rank,
        username: entry.username,
        wager_amount: entry.wager_amount,
        prize_amount: entry.prize_amount,
      }))

      // Delete existing entries first
      await supabase.from("leaderboard_entries").delete().eq("leaderboard_id", selectedLeaderboard)

      const { error } = await supabase.from("leaderboard_entries").insert(entries)

      if (error) throw error

      toast({
        title: "Success",
        description: `Fetched ${entries.length} entries from API`,
        className: "bg-green-600 text-white",
      })
      fetchEntries(selectedLeaderboard)
    } catch (error) {
      console.error("[v0] Error fetching from API:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data from API",
        variant: "destructive",
      })
    }
  }

  function startEditEntry(entry: LeaderboardEntry) {
    setEditingEntry(entry.id)
    setEditForm({
      username: entry.username,
      wager_amount: entry.wager_amount.toString(),
      prize_amount: entry.prize_amount.toString(),
    })
  }

  async function saveEditEntry(entryId: string) {
    const { error } = await supabase
      .from("leaderboard_entries")
      .update({
        username: editForm.username,
        wager_amount: Number.parseFloat(editForm.wager_amount),
        prize_amount: Number.parseFloat(editForm.prize_amount),
      })
      .eq("id", entryId)

    if (error) {
      console.error("[v0] Error updating entry:", error)
      toast({
        title: "Error",
        description: "Failed to update entry",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Entry updated successfully",
        className: "bg-green-600 text-white",
      })
      setEditingEntry(null)
      if (selectedLeaderboard) fetchEntries(selectedLeaderboard)
    }
  }

  function downloadCsvTemplate() {
    const template = "username,wager_amount\nPlayer123,1000.00\nPlayer456,800.00"
    const blob = new Blob([template], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "leaderboard_template.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  function startEditLeaderboard(lb: Leaderboard) {
    setEditingLeaderboard(lb.id)
    setEditLeaderboardForm({
      title: lb.title,
      subtitle: lb.subtitle || "",
      prize_pool: lb.prize_pool.toString(),
      prize_distribution_type: lb.prize_distribution_type,
      api_url: lb.api_url || "",
      api_key: lb.api_key || "",
      image_url: lb.image_url || "",
      start_date: lb.start_date,
      end_date: lb.end_date,
      status: lb.status,
    })
  }

  async function saveEditLeaderboard(leaderboardId: string) {
    const { error } = await supabase
      .from("leaderboards")
      .update({
        title: editLeaderboardForm.title,
        subtitle: editLeaderboardForm.subtitle || null,
        prize_pool: Number.parseFloat(editLeaderboardForm.prize_pool),
        prize_distribution_type: editLeaderboardForm.prize_distribution_type,
        api_url: editLeaderboardForm.api_url || null,
        api_key: editLeaderboardForm.api_key || null,
        image_url: editLeaderboardForm.image_url || null,
        start_date: editLeaderboardForm.start_date,
        end_date: editLeaderboardForm.end_date,
        status: editLeaderboardForm.status,
      })
      .eq("id", leaderboardId)

    if (error) {
      console.error("[v0] Error updating leaderboard:", error)
      toast({
        title: "Error",
        description: "Failed to update leaderboard",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Leaderboard updated successfully",
        className: "bg-green-600 text-white",
      })
      setEditingLeaderboard(null)
      fetchLeaderboards()
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
    <div className="p-3">
      <div className="mt-3 space-y-3">
        {/* Create Leaderboard Section */}
        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
          <CardHeader className="p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4" />
                Manage Leaderboards
              </CardTitle>
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Create New
              </Button>
            </div>
          </CardHeader>
          {showCreateForm && (
            <CardContent className="p-3 pt-0">
              <form onSubmit={handleCreateLeaderboard} className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="title" className="text-slate-300 text-xs">
                      Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="STAKE.COM & STAKE.US"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="subtitle" className="text-slate-300 text-xs">
                      Subtitle
                    </Label>
                    <Input
                      id="subtitle"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="Optional subtitle"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="image_url" className="text-slate-300 text-xs flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      Header Image URL
                    </Label>
                    <Input
                      id="image_url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="https://example.com/header-image.png"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Upload image to Vercel Blob or use external URL</p>
                  </div>
                  <div>
                    <Label htmlFor="prize_pool" className="text-slate-300 text-xs">
                      Prize Pool ($)
                    </Label>
                    <Input
                      id="prize_pool"
                      type="number"
                      step="0.01"
                      value={prizePool}
                      onChange={(e) => setPrizePool(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="20000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="prize_distribution" className="text-slate-300 text-xs">
                      Prize Distribution
                    </Label>
                    <select
                      id="prize_distribution"
                      value={prizeDistribution}
                      onChange={(e) => setPrizeDistribution(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white h-8 text-xs rounded-md px-2"
                    >
                      <option value="classic">Classic Top-Heavy (1st: 50%, 2nd: 25%, 3rd: 15%)</option>
                      <option value="balanced">Balanced Split (1st: 30%, 2nd: 20%, 3rd: 15%)</option>
                      <option value="wide">Wide Distribution (1st: 15%, 2-3rd: 15%, 4-10th: 20%)</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="api_url" className="text-slate-300 text-xs">
                      API URL (Optional)
                    </Label>
                    <Input
                      id="api_url"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="https://api.example.com/leaderboard"
                    />
                  </div>
                  <div>
                    <Label htmlFor="api_key" className="text-slate-300 text-xs">
                      API Key (Optional)
                    </Label>
                    <Input
                      id="api_key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="Bearer token or API key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-slate-300 text-xs">
                      Status
                    </Label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white h-8 text-xs rounded-md px-2"
                    >
                      <option value="active">Active</option>
                      <option value="ended">Ended</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="start_date" className="text-slate-300 text-xs">
                      Start Date
                    </Label>
                    <Input
                      id="start_date"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date" className="text-slate-300 text-xs">
                      End Date
                    </Label>
                    <Input
                      id="end_date"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 h-8 text-xs">
                  Create Leaderboard
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Leaderboards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {leaderboards.map((lb) => (
            <Card
              key={lb.id}
              className={`bg-slate-900/60 backdrop-blur border-slate-700/50 transition-all ${
                selectedLeaderboard === lb.id ? "ring-2 ring-cyan-500" : ""
              }`}
            >
              <CardContent className="p-3">
                {editingLeaderboard === lb.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editLeaderboardForm.title}
                      onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, title: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="Title"
                    />
                    <Input
                      value={editLeaderboardForm.subtitle}
                      onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, subtitle: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="Subtitle"
                    />
                    <Input
                      type="number"
                      value={editLeaderboardForm.prize_pool}
                      onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, prize_pool: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="Prize Pool"
                    />
                    <Input
                      value={editLeaderboardForm.image_url}
                      onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, image_url: e.target.value })}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                      placeholder="Image URL"
                    />
                    <select
                      value={editLeaderboardForm.status}
                      onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, status: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 text-white h-8 text-xs rounded-md px-2"
                    >
                      <option value="active">Active</option>
                      <option value="ended">Ended</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => saveEditLeaderboard(lb.id)}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 h-7 text-xs"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingLeaderboard(null)}
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-300 h-7 text-xs bg-transparent"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          setSelectedLeaderboard(lb.id)
                          fetchEntries(lb.id)
                        }}
                      >
                        <h3 className="text-sm font-bold text-white">{lb.title}</h3>
                        {lb.subtitle && <p className="text-[10px] text-slate-400">{lb.subtitle}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => startEditLeaderboard(lb)}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteLeaderboard(lb.id)
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Prize Pool:</span>
                        <span className="text-amber-400 font-bold">${lb.prize_pool.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Distribution:</span>
                        <span className="text-cyan-400 capitalize">{lb.prize_distribution_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status:</span>
                        <span
                          className={`font-bold ${
                            lb.status === "active"
                              ? "text-green-400"
                              : lb.status === "ended"
                                ? "text-red-400"
                                : "text-amber-400"
                          }`}
                        >
                          {lb.status.toUpperCase()}
                        </span>
                      </div>
                      {lb.api_url && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">API:</span>
                          <span className="text-purple-400">Configured</span>
                        </div>
                      )}
                      {lb.image_url && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Header Image:</span>
                          <span className="text-slate-400">✓</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Entries Management */}
        {selectedLeaderboard && (
          <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  Leaderboard Entries
                </CardTitle>
                <div className="flex gap-2">
                  {leaderboards.find((lb) => lb.id === selectedLeaderboard)?.api_url && (
                    <Button onClick={fetchFromApi} size="sm" className="bg-purple-600 hover:bg-purple-700 h-7 text-xs">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Fetch API
                    </Button>
                  )}
                  <Button
                    onClick={downloadCsvTemplate}
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-800 h-7 text-xs bg-transparent"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Template
                  </Button>
                  <Button
                    onClick={() => setShowCsvUpload(!showCsvUpload)}
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700 h-7 text-xs"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {showCsvUpload && (
                <div className="space-y-3 mb-3 p-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <Label htmlFor="csv_file" className="text-slate-300 text-xs mb-2 block">
                      Upload CSV File
                    </Label>
                    <Input
                      id="csv_file"
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileChange}
                      className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      CSV format: username,wager_amount (prizes calculated automatically)
                    </p>
                  </div>

                  {csvPreview.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-300 text-xs">Preview ({csvPreview.length} entries)</Label>
                        <Button
                          onClick={handleCsvUpload}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                        >
                          Confirm Upload
                        </Button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {csvPreview.slice(0, 10).map((entry, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-slate-900/50 rounded text-[10px]"
                          >
                            <span className="text-white">{entry.username}</span>
                            <span className="text-slate-400">${entry.wager_amount?.toLocaleString()}</span>
                          </div>
                        ))}
                        {csvPreview.length > 10 && (
                          <p className="text-[10px] text-slate-400 text-center py-1">
                            ... and {csvPreview.length - 10} more entries
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 bg-slate-800/30 rounded hover:bg-slate-800/50 transition-colors"
                  >
                    {editingEntry === entry.id ? (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="text-xs text-slate-400 w-6">#{entry.rank}</div>
                          <Input
                            value={editForm.username}
                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                            className="bg-slate-900 border-slate-700 text-white h-6 text-xs flex-1"
                          />
                          <Input
                            type="number"
                            value={editForm.wager_amount}
                            onChange={(e) => setEditForm({ ...editForm, wager_amount: e.target.value })}
                            className="bg-slate-900 border-slate-700 text-white h-6 text-xs w-24"
                          />
                          <Input
                            type="number"
                            value={editForm.prize_amount}
                            onChange={(e) => setEditForm({ ...editForm, prize_amount: e.target.value })}
                            className="bg-slate-900 border-slate-700 text-white h-6 text-xs w-24"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            onClick={() => saveEditEntry(entry.id)}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/20"
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => setEditingEntry(null)}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-800"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-slate-400 w-6">#{entry.rank}</div>
                          <div className="text-xs text-white">{entry.username}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-slate-400">${entry.wager_amount.toLocaleString()}</div>
                          <div className="text-xs text-amber-400 font-bold">${entry.prize_amount.toLocaleString()}</div>
                          <Button
                            onClick={() => startEditEntry(entry)}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteEntry(entry.id)}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
