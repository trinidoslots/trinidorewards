"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trophy, Plus, Pencil, Trash2, Users, DollarSign, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Tournament {
  id: string
  title: string
  description: string
  image_url: string
  prize_pool: number
  entry_fee: number
  max_participants: number
  current_participants: number
  tournament_type: string
  game_type: string
  status: string
  start_date: string
  end_date: string
  registration_deadline: string
  rules: string
  featured: boolean
  winner_username: string | null
  winner_prize: number | null
}

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    prize_pool: "",
    entry_fee: "",
    max_participants: "",
    tournament_type: "bracket",
    game_type: "",
    status: "upcoming",
    start_date: "",
    end_date: "",
    registration_deadline: "",
    rules: "",
    featured: false,
  })

  const supabase = createBrowserClient()
  const router = useRouter()

  useEffect(() => {
    fetchTournaments()
    // Update tournament statuses every minute
    const interval = setInterval(updateTournamentStatuses, 60000)
    return () => clearInterval(interval)
  }, [])

  async function updateTournamentStatuses() {
    try {
      await supabase.rpc("update_tournament_status")
      fetchTournaments()
    } catch (error) {
      console.error("Error updating tournament statuses:", error)
    }
  }

  async function fetchTournaments() {
    try {
      const { data, error } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setTournaments(data || [])
    } catch (error) {
      console.error("Error fetching tournaments:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(tournament: Tournament) {
    setEditingId(tournament.id)
    setFormData({
      title: tournament.title,
      description: tournament.description ?? "",
      image_url: tournament.image_url ?? "",
      prize_pool: (tournament.prize_pool ?? 0).toString(),
      entry_fee: (tournament.entry_fee ?? 0).toString(),
      max_participants: (tournament.max_participants ?? 0).toString(),
      tournament_type: tournament.tournament_type,
      game_type: tournament.game_type ?? "",
      status: tournament.status,
      start_date: tournament.start_date ? tournament.start_date.slice(0, 16) : "",
      end_date: tournament.end_date ? tournament.end_date.slice(0, 16) : "",
      registration_deadline: tournament.registration_deadline ? tournament.registration_deadline.slice(0, 16) : "",
      rules: tournament.rules ?? "",
      featured: tournament.featured,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const tournamentData = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url || null,
        prize_pool: Number.parseFloat(formData.prize_pool) || 0,
        entry_fee: Number.parseFloat(formData.entry_fee) || 0,
        max_participants: Number.parseInt(formData.max_participants) || 0,
        tournament_type: formData.tournament_type,
        game_type: formData.game_type || null,
        status: formData.status,
        start_date: formData.start_date,
        end_date: formData.end_date,
        registration_deadline: formData.registration_deadline || null,
        rules: formData.rules || null,
        featured: formData.featured,
      }

      if (editingId) {
        const { error } = await supabase.from("tournaments").update(tournamentData).eq("id", editingId)

        if (error) throw error

        if (formData.status === "active") {
          router.push("/admin/tournaments/opening")
          return
        }
      } else {
        const { data, error } = await supabase.from("tournaments").insert([tournamentData]).select().single()

        if (error) throw error

        router.push("/admin/tournaments/opening")
        return
      }

      setShowForm(false)
      setEditingId(null)
      setFormData({
        title: "",
        description: "",
        image_url: "",
        prize_pool: "",
        entry_fee: "",
        max_participants: "",
        tournament_type: "bracket",
        game_type: "",
        status: "upcoming",
        start_date: "",
        end_date: "",
        registration_deadline: "",
        rules: "",
        featured: false,
      })
      fetchTournaments()
    } catch (error: any) {
      console.error("Error saving tournament:", error)
      alert("Error saving tournament: " + error.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this tournament?")) return

    try {
      const { error } = await supabase.from("tournaments").delete().eq("id", id)

      if (error) throw error
      fetchTournaments()
    } catch (error) {
      console.error("Error deleting tournament:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "registration":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20"
      case "active":
        return "bg-green-500/10 text-green-400 border-green-500/20"
      case "completed":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20"
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20"
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading tournaments...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Tournaments</h1>
          <p className="text-slate-400">Create and manage competitive tournaments</p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm)
            setEditingId(null)
            setFormData({
              title: "",
              description: "",
              image_url: "",
              prize_pool: "",
              entry_fee: "",
              max_participants: "",
              tournament_type: "bracket",
              game_type: "",
              status: "upcoming",
              start_date: "",
              end_date: "",
              registration_deadline: "",
              rules: "",
              featured: false,
            })
          }}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showForm ? "Cancel" : "Add Tournament"}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-800/50 border-slate-700/50 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-white">
                  Tournament Title *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="game_type" className="text-white">
                  Game Type
                </Label>
                <Input
                  id="game_type"
                  value={formData.game_type}
                  onChange={(e) => setFormData({ ...formData, game_type: e.target.value })}
                  placeholder="e.g., Slots, Blackjack"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prize_pool" className="text-white">
                  Prize Pool ($) *
                </Label>
                <Input
                  id="prize_pool"
                  type="number"
                  step="0.01"
                  value={formData.prize_pool}
                  onChange={(e) => setFormData({ ...formData, prize_pool: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry_fee" className="text-white">
                  Entry Fee ($)
                </Label>
                <Input
                  id="entry_fee"
                  type="number"
                  step="0.01"
                  value={formData.entry_fee}
                  onChange={(e) => setFormData({ ...formData, entry_fee: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_participants" className="text-white">
                  Max Participants
                </Label>
                <Input
                  id="max_participants"
                  type="number"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                  placeholder="0 for unlimited"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tournament_type" className="text-white">
                  Tournament Type
                </Label>
                <Select
                  value={formData.tournament_type}
                  onValueChange={(value) => setFormData({ ...formData, tournament_type: value })}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bracket">Bracket</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="leaderboard">Leaderboard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-white">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-white">
                  Start Date *
                </Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="text-white">
                  End Date *
                </Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registration_deadline" className="text-white">
                  Registration Deadline
                </Label>
                <Input
                  id="registration_deadline"
                  type="datetime-local"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url" className="text-white">
                  Image URL
                </Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded"
                  />
                  Featured Tournament
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rules" className="text-white">
                Rules
              </Label>
              <Textarea
                id="rules"
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white min-h-[100px]"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
            >
              {editingId ? "Update Tournament" : "Create Tournament"}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-6">
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="bg-slate-800/50 border-slate-700/50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-cyan-400 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{tournament.title}</h3>
                      <Badge className={getStatusColor(tournament.status)}>{tournament.status.toUpperCase()}</Badge>
                      {tournament.featured && (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">FEATURED</Badge>
                      )}
                    </div>
                    {tournament.description && <p className="text-slate-400 text-sm mb-3">{tournament.description}</p>}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <span className="text-slate-400">Prize Pool:</span>
                        <span className="text-white font-semibold">${tournament.prize_pool.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span className="text-slate-400">Participants:</span>
                        <span className="text-white font-semibold">
                          {tournament.current_participants}
                          {tournament.max_participants > 0 && `/${tournament.max_participants}`}
                        </span>
                      </div>
                      {tournament.game_type && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Game:</span>
                          <span className="text-white font-semibold">{tournament.game_type}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {tournament.status === "active" && (
                  <Button
                    onClick={() => router.push("/admin/tournaments/opening")}
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-400"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Opening Mode
                  </Button>
                )}
                <Button
                  onClick={() => handleEdit(tournament)}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 hover:bg-slate-700"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(tournament.id)}
                  variant="outline"
                  size="sm"
                  className="border-red-500/20 hover:bg-red-500/10 text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {tournaments.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700/50 p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Tournaments Yet</h3>
            <p className="text-slate-400">Create your first tournament to get started</p>
          </Card>
        )}
      </div>
    </div>
  )
}
