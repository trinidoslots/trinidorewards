"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { BracketVisualizer } from "@/components/bracket-visualizer"

interface TournamentBracketViewProps {
  tournamentId: string
  maxParticipants: number
}

export function TournamentBracketView({ tournamentId, maxParticipants }: TournamentBracketViewProps) {
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchSlots()
  }, [tournamentId])

  async function fetchSlots() {
    try {
      const { data, error } = await supabase
        .from("tournament_slots")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("slot_position")

      if (!error && data) {
        setSlots(data)
      }
    } catch (error) {
      console.error("Error fetching tournament slots:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50 p-8 text-center">
        <p className="text-slate-400">Loading tournament bracket...</p>
      </Card>
    )
  }

  if (slots.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50 p-8 text-center">
        <p className="text-slate-400">Tournament bracket is being prepared...</p>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Tournament Bracket</h2>
        <p className="text-slate-400">Live bracket for {slots.length} participants</p>
      </div>
      <div className="overflow-x-auto">
        <BracketVisualizer
          slots={slots.map((slot) => ({
            slot_position: slot.slot_position,
            participant_name: slot.participant_name,
            admin_note: slot.admin_note,
          }))}
          maxParticipants={maxParticipants}
        />
      </div>
    </Card>
  )
}
