"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Calendar, DollarSign, Users } from "lucide-react"
import { TournamentBracketView } from "@/components/tournament-bracket-view"

interface Tournament {
  id: string
  title: string
  description: string
  prize_pool: number
  max_participants: number
  status: string
  start_date: string
  tournament_type: string
}

export default function TournamentDetailPage() {
  const params = useParams()
  const tournamentId = params.id as string
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchData()
  }, [tournamentId])

  async function fetchData() {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single()

      if (tournamentError) throw tournamentError
      setTournament(tournamentData)

      const { data: slotsData, error: slotsError } = await supabase
        .from("tournament_slots")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("slot_position")

      if (!slotsError && slotsData) {
        setSlots(slotsData)
      }
    } catch (error) {
      console.error("Error fetching tournament:", error)
    } finally {
      setLoading(false)
    }
  }

  const filledSlots = slots.filter((s) => s.participant_name && s.participant_name.trim()).length
  const fillPercentage = tournament ? Math.round((filledSlots / tournament.max_participants) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Loading tournament...</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Tournament not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">{tournament.title}</h1>
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">{tournament.status.toUpperCase()}</Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-700/30 p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Prize Pool</p>
                <p className="text-2xl font-bold text-white">${tournament.prize_pool.toFixed(2)}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/30 p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Participants</p>
                <p className="text-2xl font-bold text-white">
                  {filledSlots}/{tournament.max_participants}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/30 p-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Type</p>
                <p className="text-2xl font-bold text-white capitalize">{tournament.tournament_type}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/30 p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase">Filled</p>
                <p className="text-2xl font-bold text-white">{fillPercentage}%</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Bracket */}
        {slots.length > 0 && (
          <Card className="bg-slate-900/60 border-slate-700/50 p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Tournament Bracket</h2>
            <TournamentBracketView tournamentId={tournamentId} maxParticipants={tournament.max_participants} />
          </Card>
        )}
      </div>
    </div>
  )
}
