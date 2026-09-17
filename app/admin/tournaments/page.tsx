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
import { Trophy, Plus } from "lucide-react"
import { TournamentCard } from "@/components/tournament-card"

interface Tournament {
  id: string
  title: string
  description: string
  image_url: string
  prize_pool: number
  entry_fee: number
  max_participants: number
  tournament_type: string
  game_type: string
  status: string
  start_date: string
  end_date: string
  registration_deadline: string
  rules: string
  featured: boolean
  current_participants: number
  winner_username: string
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
    rules: "",
    featured: false,
  })

  const supabase = createBrowserClient()
  const router = useRouter()

  useEffect(() => {
    fetchTournaments()
  }, [])

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
      rules: tournament.rules ?? "",
      featured: tournament.featured,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const now = new Date().toISOString()
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const tournamentData = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url || null,
        prize_pool: Number.parseFloat(formData.prize_pool) || 0,
        entry_fee: Number.parseFloat(formData.entry_fee) || 0,
        max_participants: Number.parseInt(formData.max_participants) || 0,
        tournament_type: formData.tournament_type,
        game_type: formData.game_type || null,
        status: "active",
        start_date: now,
        end_date: futureDate,
        rules: formData.rules || null,
        featured: formData.featured,
      }

      if (editingId) {
        const { error } = await supabase.from("tournaments").update(tournamentData).eq("id", editingId)
        if (error) throw error
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
          rules: "",
          featured: false,
        })
        fetchTournaments()
      } else {
        const { data, error } = await supabase.from("tournaments").insert([tournamentData]).select().single()
        if (error) throw error
        router.push(`/admin/tournaments/${data.id}/slots`)
      }
    } catch (error: any) {
      console.error("Error saving tournament:", error)
      alert("Error saving tournament: " + error.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this tournament?")) {
      return
    }

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
                <Label htmlFor="max_participants" className="text-white font-semibold">
                  Max Participants
                </Label>
                <Select
                  value={formData.max_participants}
                  onValueChange={(value) => setFormData({ ...formData, max_participants: value })}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                    <SelectValue placeholder="Select participant count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Players</SelectItem>
                    <SelectItem value="4">4 Players</SelectItem>
                    <SelectItem value="8">8 Players</SelectItem>
                    <SelectItem value="16">16 Players</SelectItem>
                    <SelectItem value="32">32 Players</SelectItem>
                    <SelectItem value="64">64 Players</SelectItem>
                    <SelectItem value="128">128 Players</SelectItem>
                    <SelectItem value="256">256 Players</SelectItem>
                  </SelectContent>
                </Select>
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

      <div className="grid gap-4">
        {tournaments.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            getStatusColor={getStatusColor}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}

        {tournaments.length === 0 && (
          <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50 p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Tournaments Yet</h3>
            <p className="text-slate-400 mb-6">Create your first tournament bracket to get started</p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Tournament
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
