"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BracketVisualizer } from "@/components/bracket-visualizer"
import { Trophy, Users, DollarSign, Eye, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react"

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
  rules: string
  featured: boolean
  winner_username: string | null
  winner_prize: number | null
}

interface TournamentCardProps {
  tournament: Tournament
  getStatusColor: (status: string) => string
  onEdit: (tournament: Tournament) => void
  onDelete: (id: string) => void
}

export function TournamentCard({ tournament, getStatusColor, onEdit, onDelete }: TournamentCardProps) {
  const router = useRouter()
  const [slots, setSlots] = useState<any[]>([])
  const [showBracket, setShowBracket] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchSlots()
  }, [tournament.id])

  async function fetchSlots() {
    try {
      const { data, error } = await supabase
        .from("tournament_slots")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("slot_position")

      if (!error && data) {
        setSlots(data)
      }
    } catch (error) {
      console.error("Error fetching slots:", error)
    }
  }

  return (
    <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50 p-6 hover:border-slate-600/50 transition-colors space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">{tournament.title}</h3>
                <Badge className={getStatusColor(tournament.status)}>
                  {tournament.status === "completed" ? "ENDED" : "ACTIVE"}
                </Badge>
                {tournament.featured && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">FEATURED</Badge>}
              </div>
              {tournament.description && <p className="text-slate-400 text-sm mb-3">{tournament.description}</p>}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-400">Prize:</span>
                  <span className="text-white font-semibold">${tournament.prize_pool.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-400">Participants:</span>
                  <span className="text-white font-semibold">
                    {slots.length}/{tournament.max_participants}
                  </span>
                </div>
                {tournament.game_type && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Game:</span>
                    <span className="text-white font-semibold">{tournament.game_type}</span>
                  </div>
                )}
              </div>
              {tournament.winner_username && (
                <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded text-sm">
                  <span className="text-green-400">Winner: </span>
                  <span className="text-white font-semibold">{tournament.winner_username}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button
            onClick={() => router.push(`/admin/tournaments/${tournament.id}/bracket`)}
            variant="outline"
            size="sm"
            className="border-cyan-500/20 hover:bg-cyan-500/10 text-cyan-400"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Bracket
          </Button>
          <Button
            onClick={() => onEdit(tournament)}
            variant="outline"
            size="sm"
            className="border-slate-600 hover:bg-slate-800 text-slate-300"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => onDelete(tournament.id)}
            variant="outline"
            size="sm"
            className="border-red-500/20 hover:bg-red-500/10 text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {slots.length > 0 && (
        <div className="border-t border-slate-700/50 pt-4">
          <Button
            onClick={() => setShowBracket(!showBracket)}
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white"
          >
            {showBracket ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Hide Bracket Preview
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Show Bracket Preview
              </>
            )}
          </Button>

          {showBracket && (
            <div className="mt-4 overflow-x-auto">
              <BracketVisualizer
                slots={slots.map((slot) => ({
                  slot_position: slot.slot_position,
                  participant_name: slot.participant_name,
                  admin_note: slot.admin_note,
                }))}
                maxParticipants={tournament.max_participants}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
