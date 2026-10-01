"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
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
      <div className="h-40 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" />
    )
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6 text-[14px] text-white/50">
        The bracket is being prepared.
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0E0E12] p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Bracket</h2>
        <p className="text-[12.5px] text-white/40">{slots.length} players</p>
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
    </section>
  )
}
