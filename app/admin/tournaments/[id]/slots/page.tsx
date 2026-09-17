"use client"

import type React from "react"
import { useRouter, useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Trophy, Save, ChevronLeft } from "lucide-react"

interface SlotAssignment {
  slot_position: number
  participant_name: string
  admin_note: string
}

export default function SlotAssignmentPage() {
  const router = useRouter()
  const params = useParams()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<any>(null)
  const [slots, setSlots] = useState<SlotAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchTournamentAndSlots()
  }, [])

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

      // Initialize slots if they don't exist
      if (!slotsData || slotsData.length === 0) {
        const maxParticipants = tournamentData.max_participants
        const newSlots: SlotAssignment[] = []
        for (let i = 1; i <= maxParticipants; i++) {
          newSlots.push({
            slot_position: i,
            participant_name: "",
            admin_note: "",
          })
        }
        setSlots(newSlots)
      } else {
        setSlots(
          slotsData.map((slot: any) => ({
            slot_position: slot.slot_position,
            participant_name: slot.participant_name || "",
            admin_note: slot.admin_note || "",
          }))
        )
      }
    } catch (error) {
      console.error("Error fetching tournament slots:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleSlotChange(index: number, field: keyof SlotAssignment, value: string) {
    const newSlots = [...slots]
    newSlots[index] = { ...newSlots[index], [field]: value }
    setSlots(newSlots)
  }

  async function handleSaveSlots() {
    setSaving(true)
    try {
      // Delete existing slots
      await supabase.from("tournament_slots").delete().eq("tournament_id", tournamentId)

      // Insert new slots
      const slotsToInsert = slots
        .filter((slot) => slot.participant_name.trim() !== "")
        .map((slot) => ({
          tournament_id: tournamentId,
          slot_position: slot.slot_position,
          participant_name: slot.participant_name,
          admin_note: slot.admin_note,
        }))

      if (slotsToInsert.length > 0) {
        const { error } = await supabase.from("tournament_slots").insert(slotsToInsert)
        if (error) throw error
      }

      alert("Slots saved successfully!")
      router.push(`/admin/tournaments/${tournamentId}/bracket`)
    } catch (error) {
      console.error("Error saving slots:", error)
      alert("Error saving slots: " + (error as any).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading tournament...</div>
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
            className="border-slate-700 hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Assign Tournament Slots</h1>
            <p className="text-slate-400">{tournament.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50 p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Tournament Slots</h2>
              <p className="text-slate-400 text-sm mb-6">
                Assign participants to each bracket slot and add optional notes. Notes will be visible in the tournament bracket.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {slots.map((slot, index) => (
                <div key={slot.slot_position} className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-cyan-400" />
                    <Label className="text-white font-semibold">Slot {slot.slot_position}</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`participant-${index}`} className="text-slate-300 text-sm">
                      Participant Name
                    </Label>
                    <Input
                      id={`participant-${index}`}
                      placeholder="Enter participant name"
                      value={slot.participant_name}
                      onChange={(e) => handleSlotChange(index, "participant_name", e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`note-${index}`} className="text-slate-300 text-sm">
                      Admin Note
                    </Label>
                    <Textarea
                      id={`note-${index}`}
                      placeholder="Add a note for this slot (e.g., seeding, notes)"
                      value={slot.admin_note}
                      onChange={(e) => handleSlotChange(index, "admin_note", e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white placeholder-slate-500 min-h-[60px] resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-6 border-t border-slate-700/50">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSlots}
                disabled={saving}
                className="bg-cyan-600 hover:bg-cyan-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Slots & View Bracket"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
