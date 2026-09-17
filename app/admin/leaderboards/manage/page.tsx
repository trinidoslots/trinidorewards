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
import { DEFAULT_PRESET_ID, PAYOUT_PRESETS, payoutSummary, rankEntries } from "@/lib/leaderboard-payouts"
import {
  COMMON_TIMEZONES,
  DEFAULT_TIMEZONE,
  leaderboardStatus,
  utcToZonedInput,
  zonedInputToUtc,
} from "@/lib/leaderboard-time"
import { Trophy, Plus, Trash2, Users, Upload, Download, Edit, Save, X, RefreshCw, ImageIcon } from "lucide-react"
import { calculateLeaderboardStatus } from "@/lib/leaderboard-utils"

type Leaderboard = {
  id: string
  title: string
  subtitle: string | null
  prize_pool: number
  prize_distribution_type: string
  payout_preset: string | null
  timezone: string | null
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

export default function LeaderboardsManagePage() {
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
  const [prizeDistribution, setPrizeDistribution] = useState(DEFAULT_PRESET_ID)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [apiUrl, setApiUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

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
    timezone: DEFAULT_TIMEZONE,
    api_url: "",
    api_key: "",
    image_url: "",
    start_date: "",
    end_date: "",
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

    // The inputs are wall-clock time in `timezone`, not UTC and not the
    // browser's zone — converting here is what stops a board closing early.
    const startIso = zonedInputToUtc(startDate, timezone)
    const endIso = zonedInputToUtc(endDate, timezone)
    if (!startIso || !endIso) {
      toast({ title: "Error", description: "Enter a valid start and end date.", variant: "destructive" })
      return
    }
    const calculatedStatus = leaderboardStatus(startIso, endIso)

    const { error } = await supabase.from("leaderboards").insert([
      {
        title,
        subtitle: subtitle || null,
        prize_pool: Number.parseFloat(prizePool),
        prize_distribution_type: prizeDistribution,
        payout_preset: prizeDistribution,
        timezone,
        api_url: apiUrl || null,
        api_key: apiKey || null,
        image_url: imageUrl || null,
        start_date: startIso,
        end_date: endIso,
        status: calculatedStatus, // Use calculated status
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
        })

        return entry
      })

      setCsvPreview(data)
    }
    reader.readAsText(file)
  }

  async function handleCsvUpload() {
    if (!selectedLeaderboard || csvPreview.length === 0) return

    const leaderboard = leaderboards.find((lb) => lb.id === selectedLeaderboard)
    if (!leaderboard) return

    const entriesWithPrizes = rankEntries<{ username: string; wager_amount: number }>(csvPreview, leaderboard.prize_pool, leaderboard.payout_preset ?? leaderboard.prize_distribution_type)

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

      const entriesWithPrizes = rankEntries<{ username: string; wager_amount: number }>(data, leaderboard.prize_pool, leaderboard.payout_preset ?? leaderboard.prize_distribution_type)

      const entries = entriesWithPrizes.map((entry) => ({
        leaderboard_id: selectedLeaderboard,
        rank: entry.rank,
        username: entry.username,
        wager_amount: entry.wager_amount,
        prize_amount: entry.prize_amount,
      }))

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
      timezone: lb.timezone || DEFAULT_TIMEZONE,
      start_date: utcToZonedInput(lb.start_date, lb.timezone || DEFAULT_TIMEZONE),
      end_date: utcToZonedInput(lb.end_date, lb.timezone || DEFAULT_TIMEZONE),
    })
  }

  async function saveEditLeaderboard(leaderboardId: string) {
    const editZone = editLeaderboardForm.timezone || DEFAULT_TIMEZONE
    const startIso = zonedInputToUtc(editLeaderboardForm.start_date, editZone)
    const endIso = zonedInputToUtc(editLeaderboardForm.end_date, editZone)
    if (!startIso || !endIso) {
      toast({ title: "Error", description: "Enter a valid start and end date.", variant: "destructive" })
      return
    }
    const calculatedStatus = leaderboardStatus(startIso, endIso)

    const { error } = await supabase
      .from("leaderboards")
      .update({
        title: editLeaderboardForm.title,
        subtitle: editLeaderboardForm.subtitle || null,
        prize_pool: Number.parseFloat(editLeaderboardForm.prize_pool),
        prize_distribution_type: editLeaderboardForm.prize_distribution_type,
        payout_preset: editLeaderboardForm.prize_distribution_type,
        timezone: editZone,
        api_url: editLeaderboardForm.api_url || null,
        api_key: editLeaderboardForm.api_key || null,
        image_url: editLeaderboardForm.image_url || null,
        start_date: startIso,
        end_date: endIso,
        status: calculatedStatus, // Use calculated status
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
        <Card className="bg-white/[0.022] backdrop-blur border-white/[0.08]">
          <CardHeader className="p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4" />
                Manage Leaderboards
              </CardTitle>
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                size="sm"
                className="bg-[#5B8DEF] hover:bg-[#4A7AD8] h-7 text-xs"
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
                    <Label htmlFor="title" className="text-white/60 text-xs">
                      Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      placeholder="STAKE.COM & STAKE.US"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="subtitle" className="text-white/60 text-xs">
                      Subtitle
                    </Label>
                    <Input
                      id="subtitle"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      placeholder="Optional subtitle"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="image_url" className="text-white/60 text-xs flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      Header Image URL
                    </Label>
                    <Input
                      id="image_url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      placeholder="https://example.com/header-image.png"
                    />
                    <p className="text-[10px] text-white/40 mt-1">Upload image to Vercel Blob or use external URL</p>
                  </div>
                  <div>
                    <Label htmlFor="prize_pool" className="text-white/60 text-xs">
                      Prize Pool ($)
                    </Label>
                    <Input
                      id="prize_pool"
                      type="number"
                      step="0.01"
                      value={prizePool}
                      onChange={(e) => setPrizePool(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      placeholder="20000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="prize_distribution" className="text-white/60 text-xs">
                      Prize Distribution
                    </Label>
                    <select
                      id="prize_distribution"
                      value={prizeDistribution}
                      onChange={(e) => setPrizeDistribution(e.target.value)}
                      className="w-full bg-[#101014] border border-white/[0.10] text-white h-8 text-xs rounded-md px-2"
                    >
                      {PAYOUT_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} — {preset.shares.length} places
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="api_url" className="text-white/60 text-xs">
                      API URL (Optional)
                    </Label>
                    <Input
                      id="api_url"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      placeholder="https://api.example.com/leaderboard"
                    />
                  </div>
                  <div>
                    <Label htmlFor="api_key" className="text-white/60 text-xs">
                      API Key (Optional)
                    </Label>
                    <Input
                      id="api_key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      placeholder="Bearer token or API key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="start_date" className="text-white/60 text-xs">
                      Start Date
                    </Label>
                    <Input
                      id="start_date"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date" className="text-white/60 text-xs">
                      End Date
                    </Label>
                    <Input
                      id="end_date"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="timezone" className="text-white/60 text-xs">
                    Timezone
                  </Label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-md border border-white/[0.10] bg-[#101014] px-2 text-xs text-white h-8"
                  >
                    {COMMON_TIMEZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-white/40">
                    The dates above are read as wall-clock time in this zone, and shown in it everywhere.
                  </p>
                </div>
                {prizePool && (
                  <p className="text-[10px] text-white/40">
                    {(() => {
                      const summary = payoutSummary(Number.parseFloat(prizePool) || 0, prizeDistribution)
                      return `Pays ${summary.places} places${
                        summary.remainder ? ` · ${summary.remainder} left over after rounding` : ""
                      }`
                    })()}
                  </p>
                )}
                <p className="text-[10px] text-white/40">
                  Status will be automatically calculated based on start and end dates
                </p>
                <Button type="submit" className="w-full bg-[#5B8DEF] hover:bg-[#4A7AD8] h-8 text-xs">
                  Create Leaderboard
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Leaderboards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {leaderboards.map((lb) => {
            const calculatedStatus = calculateLeaderboardStatus(lb.start_date, lb.end_date)

            return (
              <Card
                key={lb.id}
                className={`bg-white/[0.022] backdrop-blur border-white/[0.08] transition-all ${
                  selectedLeaderboard === lb.id ? "ring-2 ring-[#5B8DEF]" : ""
                }`}
              >
                <CardContent className="p-3">
                  {editingLeaderboard === lb.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editLeaderboardForm.title}
                        onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, title: e.target.value })}
                        className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                        placeholder="Title"
                      />
                      <Input
                        value={editLeaderboardForm.subtitle}
                        onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, subtitle: e.target.value })}
                        className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                        placeholder="Subtitle"
                      />
                      <Input
                        type="number"
                        value={editLeaderboardForm.prize_pool}
                        onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, prize_pool: e.target.value })}
                        className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                        placeholder="Prize Pool"
                      />
                      <Input
                        value={editLeaderboardForm.image_url}
                        onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, image_url: e.target.value })}
                        className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                        placeholder="Image URL"
                      />
                      <Input
                        type="datetime-local"
                        value={editLeaderboardForm.start_date}
                        onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, start_date: e.target.value })}
                        className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      />
                      <Input
                        type="datetime-local"
                        value={editLeaderboardForm.end_date}
                        onChange={(e) => setEditLeaderboardForm({ ...editLeaderboardForm, end_date: e.target.value })}
                        className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                      />
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
                          className="flex-1 border-white/[0.12] text-white/60 h-7 text-xs bg-transparent"
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
                          {lb.subtitle && <p className="text-[10px] text-white/40">{lb.subtitle}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            onClick={() => startEditLeaderboard(lb)}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-[#5B8DEF] hover:text-[#5B8DEF] hover:bg-[#5B8DEF]/10"
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
                          <span className="text-white/40">Prize Pool:</span>
                          <span className="text-amber-400 font-bold">${lb.prize_pool.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Distribution:</span>
                          <span className="text-[#5B8DEF] capitalize">{lb.prize_distribution_type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Status:</span>
                          <span
                            className={`font-bold ${
                              calculatedStatus === "active"
                                ? "text-green-400"
                                : calculatedStatus === "ended"
                                  ? "text-red-400"
                                  : "text-amber-400"
                            }`}
                          >
                            {calculatedStatus.toUpperCase()}
                          </span>
                        </div>
                        {lb.api_url && (
                          <div className="flex justify-between">
                            <span className="text-white/40">API:</span>
                            <span className="text-purple-400">Configured</span>
                          </div>
                        )}
                        {lb.image_url && (
                          <div className="flex justify-between">
                            <span className="text-white/40">Header Image:</span>
                            <span className="text-white/40">✓</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Entries Management */}
        {selectedLeaderboard && (
          <Card className="bg-white/[0.022] backdrop-blur border-white/[0.08]">
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
                    className="border-white/[0.12] text-white/60 hover:bg-white/[0.06] h-7 text-xs bg-transparent"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Template
                  </Button>
                  <Button
                    onClick={() => setShowCsvUpload(!showCsvUpload)}
                    size="sm"
                    className="bg-[#5B8DEF] hover:bg-[#4A7AD8] h-7 text-xs"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {showCsvUpload && (
                <div className="space-y-3 mb-3 p-3 bg-white/[0.04] rounded-lg">
                  <div>
                    <Label htmlFor="csv_file" className="text-white/60 text-xs mb-2 block">
                      Upload CSV File
                    </Label>
                    <Input
                      id="csv_file"
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileChange}
                      className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                    />
                    <p className="text-[10px] text-white/40 mt-1">
                      CSV format: username,wager_amount (prizes calculated automatically)
                    </p>
                  </div>

                  {csvPreview.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-white/60 text-xs">Preview ({csvPreview.length} entries)</Label>
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
                            className="flex items-center justify-between p-2 bg-white/[0.022] rounded text-[10px]"
                          >
                            <span className="text-white">{entry.username}</span>
                            <span className="text-white/40">${entry.wager_amount?.toLocaleString()}</span>
                          </div>
                        ))}
                        {csvPreview.length > 10 && (
                          <p className="text-[10px] text-white/40 text-center py-1">
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
                    className="flex items-center justify-between p-2 bg-white/[0.06]/30 rounded hover:bg-white/[0.04] transition-colors"
                  >
                    {editingEntry === entry.id ? (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="text-xs text-white/40 w-6">#{entry.rank}</div>
                          <Input
                            value={editForm.username}
                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                            className="bg-[#101014] border-white/[0.10] text-white h-6 text-xs flex-1"
                          />
                          <Input
                            type="number"
                            value={editForm.wager_amount}
                            onChange={(e) => setEditForm({ ...editForm, wager_amount: e.target.value })}
                            className="bg-[#101014] border-white/[0.10] text-white h-6 text-xs w-24"
                          />
                          <Input
                            type="number"
                            value={editForm.prize_amount}
                            onChange={(e) => setEditForm({ ...editForm, prize_amount: e.target.value })}
                            className="bg-[#101014] border-white/[0.10] text-white h-6 text-xs w-24"
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
                            className="h-6 w-6 p-0 text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-white/40 w-6">#{entry.rank}</div>
                          <div className="text-xs text-white">{entry.username}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-white/40">${entry.wager_amount.toLocaleString()}</div>
                          <div className="text-xs text-amber-400 font-bold">${entry.prize_amount.toLocaleString()}</div>
                          <Button
                            onClick={() => startEditEntry(entry)}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-[#5B8DEF] hover:text-[#5B8DEF] hover:bg-[#5B8DEF]/10"
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
