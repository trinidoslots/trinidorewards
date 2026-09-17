"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BracketVisualizer } from "@/components/bracket-visualizer"
import { ArrowLeft, Edit, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Tournament {
  id: string
  title: string
  status: string
  max_participants: number
  prize_pool: number
  game_type: string
}

interface TournamentSlot {
  slot_position: number
  participant_name: string
  admin_note: string
}

export default function TournamentBracketPage() {
  const params = useParams()
  const router = useRouter()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [slots, setSlots] = useState<TournamentSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAllSlotsFilled, setHasAllSlotsFilled] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchTournamentAndSlots()
  }, [tournamentId])

  async function fetchTournamentAndSlots() {
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

      if (slotsError && slotsError.code !== "PGRST116") throw slotsError

      const slotsList = (slotsData || []) as TournamentSlot[]
      setSlots(slotsList)

      // Check if all slots are filled
      const allFilled = slotsList.length === tournamentData.max_participants
      setHasAllSlotsFilled(allFilled)
    } catch (error) {
      console.error("Error fetching tournament data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartTournament() {
    if (!tournament) return
    
    setIsStarting(true)
    try {
      const { error } = await supabase
        .from("tournaments")
        .update({ status: "active" })
        .eq("id", tournamentId)

      if (error) throw error

      setTournament({ ...tournament, status: "active" })
      alert("Tournament started! Redirecting to opening mode...")
      setTimeout(() => {
        router.push(`/admin/tournaments/${tournamentId}/opening`)
      }, 1000)
    } catch (error) {
      console.error("Error starting tournament:", error)
      alert("Failed to start tournament: " + (error as any).message)
    } finally {
      setIsStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-white/40">Loading tournament bracket...</div>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-400">Tournament not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
            className="border-white/[0.10] hover:bg-white/[0.06]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{tournament.title}</h1>
              <Badge className={tournament.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-white/[0.05] text-white/40 border-white/[0.10]"}>
                {tournament.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-white/40">
              {tournament.game_type} • {slots.length}/{tournament.max_participants} participants
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => router.push(`/admin/tournaments/${tournamentId}/slots`)}
            variant="outline"
            className="border-white/[0.10] hover:bg-white/[0.06] text-white/60"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Slots
          </Button>
          <Button
            onClick={handleStartTournament}
            disabled={!hasAllSlotsFilled || isStarting}
            className="bg-[#5B8DEF] hover:bg-[#4A7AD8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 mr-2" />
            {isStarting ? "Starting..." : "Start Tournament"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="bg-white/[0.022] backdrop-blur border-white/[0.08] p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white mb-2">Tournament Bracket</h2>
            <p className="text-white/40 text-sm">
              {hasAllSlotsFilled
                ? "All slots are filled. Ready to start the tournament!"
                : `${tournament.max_participants - slots.length} more slots to fill before tournament can start`}
            </p>
          </div>

          {slots.length > 0 ? (
            <BracketVisualizer
              slots={slots.map((slot) => ({
                slot_position: slot.slot_position,
                participant_name: slot.participant_name,
                admin_note: slot.admin_note,
              }))}
              maxParticipants={tournament.max_participants}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-white/40 mb-4">No slots assigned yet</p>
              <Button
                onClick={() => router.push(`/admin/tournaments/${tournamentId}/slots`)}
                className="bg-[#5B8DEF] hover:bg-[#4A7AD8]"
              >
                <Edit className="w-4 h-4 mr-2" />
                Assign Slots
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
