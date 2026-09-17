"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Trophy } from "lucide-react"

interface Match {
  id: string
  match_number: number
  round_number: number
  slot1_name: string
  slot2_name: string
  slot1_provider: string
  slot2_provider: string
  winner_slot: number | null
  status: string
}

interface Tournament {
  id: string
  title: string
  status: string
}

export default function TournamentOpeningMode() {
  const router = useRouter()
  const params = useParams()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchTournamentData()
  }, [tournamentId])

  async function fetchTournamentData() {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single()

      if (tournamentError) throw tournamentError
      setTournament(tournamentData)

      const { data: matchesData, error: matchesError } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round_number")
        .order("match_number")

      if (matchesError && matchesError.code !== "PGRST116") throw matchesError
      setMatches(matchesData || [])
    } catch (error) {
      console.error("Error fetching tournament data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function setWinner(matchId: string, winnerSlot: number) {
    try {
      const { error } = await supabase
        .from("tournament_matches")
        .update({ winner_slot: winnerSlot, status: "completed" })
        .eq("id", matchId)

      if (error) throw error

      setMatches(
        matches.map((m) =>
          m.id === matchId ? { ...m, winner_slot: winnerSlot, status: "completed" } : m
        )
      )
    } catch (error) {
      console.error("Error setting winner:", error)
      alert("Failed to set winner")
    }
  }

  function openNextMatch() {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  function openPreviousMatch() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B0B0D] to-[#101014] p-8">
        <div className="flex items-center justify-center h-screen">
          <div className="text-white/40">Loading tournament...</div>
        </div>
      </div>
    )
  }

  if (!tournament || matches.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B0B0D] to-[#101014] p-8">
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mb-4 border-white/[0.10] hover:bg-white/[0.06]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center justify-center h-screen">
          <div className="text-red-400">Tournament or matches not found</div>
        </div>
      </div>
    )
  }

  const currentMatch = matches[currentIndex]
  const completedCount = matches.filter((m) => m.winner_slot !== null).length
  const currentRound = matches[currentIndex]?.round_number

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0B0D] to-[#101014] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="border-white/[0.10] hover:bg-white/[0.06]"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">{tournament.title}</h1>
              <p className="text-white/40">Round {currentRound} - Match {currentMatch.match_number}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#5B8DEF]">{completedCount}/{matches.length}</p>
            <p className="text-sm text-white/40">Matches Decided</p>
          </div>
        </div>

        {/* Current Match Card */}
        <Card className="bg-white/[0.03] backdrop-blur border-white/[0.08] p-8 mb-8">
          <div className="space-y-8">
            {/* Slot 1 */}
            <div className="space-y-2">
              <p className="text-white/40 text-sm uppercase">Slot 1</p>
              <Button
                onClick={() => setWinner(currentMatch.id, 1)}
                disabled={currentMatch.status === "completed" && currentMatch.winner_slot !== 1}
                className={`w-full py-6 text-xl font-bold ${
                  currentMatch.winner_slot === 1
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-white/[0.08] hover:bg-white/[0.10] text-white"
                }`}
              >
                <Trophy className="w-5 h-5 mr-2" />
                {currentMatch.slot1_name || "TBD"}
              </Button>
              <p className="text-xs text-white/40">{currentMatch.slot1_provider}</p>
            </div>

            {/* VS Divider */}
            <div className="flex items-center justify-center">
              <div className="flex-1 h-px bg-white/[0.08]"></div>
              <span className="px-4 text-white/40 font-semibold">VS</span>
              <div className="flex-1 h-px bg-white/[0.08]"></div>
            </div>

            {/* Slot 2 */}
            <div className="space-y-2">
              <p className="text-white/40 text-sm uppercase">Slot 2</p>
              <Button
                onClick={() => setWinner(currentMatch.id, 2)}
                disabled={currentMatch.status === "completed" && currentMatch.winner_slot !== 2}
                className={`w-full py-6 text-xl font-bold ${
                  currentMatch.winner_slot === 2
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-white/[0.08] hover:bg-white/[0.10] text-white"
                }`}
              >
                <Trophy className="w-5 h-5 mr-2" />
                {currentMatch.slot2_name || "TBD"}
              </Button>
              <p className="text-xs text-white/40">{currentMatch.slot2_provider}</p>
            </div>
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Button
            onClick={openPreviousMatch}
            disabled={currentIndex === 0}
            variant="outline"
            className="flex-1 border-white/[0.10] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous Match
          </Button>

          <div className="text-center text-white/40">
            Match {currentIndex + 1} / {matches.length}
          </div>

          <Button
            onClick={openNextMatch}
            disabled={currentIndex === matches.length - 1}
            className="flex-1 bg-[#5B8DEF] hover:bg-[#4A7AD8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Match →
          </Button>
        </div>

        {/* All Matches List */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-white mb-4">All Matches</h3>
          <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {matches.map((match, index) => (
              <button
                key={match.id}
                onClick={() => setCurrentIndex(index)}
                className={`p-3 rounded-lg text-left transition-all ${
                  index === currentIndex
                    ? "bg-[#5B8DEF]/30 border border-[#5B8DEF] text-white"
                    : match.winner_slot
                    ? "bg-white/[0.04] border border-white/[0.10] text-white/60 hover:bg-white/[0.06]"
                    : "bg-white/[0.06]/30 border border-white/[0.08] text-white/40 hover:bg-white/[0.04]"
                }`}
              >
                <div className="text-sm font-medium">Round {match.round_number} - Match {match.match_number}</div>
                <div className="text-xs text-white/40 truncate">
                  {match.slot1_name && match.slot2_name
                    ? `${match.slot1_name} vs ${match.slot2_name}`
                    : match.winner_slot
                    ? `✓ Winner: Slot ${match.winner_slot}`
                    : "Pending"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
