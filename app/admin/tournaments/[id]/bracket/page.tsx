"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Trophy, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Tournament {
  id: string
  title: string
  status: string
}

interface Match {
  id: string
  round_number: number
  match_number: number
  slot1_name: string | null
  slot1_provider: string | null
  slot2_name: string | null
  slot2_provider: string | null
  winner_slot: number | null
  status: string
}

interface Slot {
  game_name: string
  provider: string
}

export default function TournamentBracketPage() {
  const params = useParams()
  const router = useRouter()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    fetchTournament()
    fetchMatches()
  }, [tournamentId])

  async function fetchTournament() {
    const { data } = await supabase.from("tournaments").select("id, title, status").eq("id", tournamentId).single()

    if (data) setTournament(data)
  }

  async function fetchMatches() {
    const { data } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round_number")
      .order("match_number")

    if (data) setMatches(data)
    setLoading(false)
  }

  async function startTournament() {
    setStarting(true)
    try {
      // Fetch 8 random slots
      const { data: allSlots } = await supabase.from("slots").select("game_name, provider")

      if (!allSlots || allSlots.length < 8) {
        alert("Not enough slots in database. Need at least 8 slots.")
        return
      }

      // Shuffle and pick 8 slots
      const shuffled = [...allSlots].sort(() => Math.random() - 0.5)
      const selectedSlots = shuffled.slice(0, 8)

      // Create Round 1 matches (4 matches)
      const round1Matches = []
      for (let i = 0; i < 4; i++) {
        round1Matches.push({
          tournament_id: tournamentId,
          round_number: 1,
          match_number: i + 1,
          slot1_name: selectedSlots[i * 2].game_name,
          slot1_provider: selectedSlots[i * 2].provider,
          slot2_name: selectedSlots[i * 2 + 1].game_name,
          slot2_provider: selectedSlots[i * 2 + 1].provider,
          status: "pending",
        })
      }

      // Insert Round 1 matches
      const { error } = await supabase.from("tournament_matches").insert(round1Matches)

      if (error) throw error

      // Update tournament status
      await supabase.from("tournaments").update({ status: "active" }).eq("id", tournamentId)

      fetchTournament()
      fetchMatches()
    } catch (error) {
      console.error("Error starting tournament:", error)
      alert("Failed to start tournament")
    } finally {
      setStarting(false)
    }
  }

  async function setWinner(matchId: string, winnerSlot: number, match: Match) {
    try {
      // Update match winner
      await supabase
        .from("tournament_matches")
        .update({
          winner_slot: winnerSlot,
          status: "completed",
        })
        .eq("id", matchId)

      // Check if all matches in current round are completed
      const currentRound = match.round_number
      const { data: roundMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round_number", currentRound)

      const allCompleted = roundMatches?.every((m) => (m.id === matchId ? true : m.status === "completed"))

      if (allCompleted && roundMatches) {
        // Create next round matches
        await createNextRound(currentRound, roundMatches)
      }

      fetchMatches()
    } catch (error) {
      console.error("Error setting winner:", error)
    }
  }

  async function createNextRound(currentRound: number, completedMatches: Match[]) {
    const nextRound = currentRound + 1
    const nextRoundMatches = []

    // Pair up winners from current round
    for (let i = 0; i < completedMatches.length; i += 2) {
      const match1 = completedMatches[i]
      const match2 = completedMatches[i + 1]

      if (!match1 || !match2) continue

      const winner1 =
        match1.winner_slot === 1
          ? { name: match1.slot1_name, provider: match1.slot1_provider }
          : { name: match1.slot2_name, provider: match1.slot2_provider }

      const winner2 =
        match2.winner_slot === 1
          ? { name: match2.slot1_name, provider: match2.slot1_provider }
          : { name: match2.slot2_name, provider: match2.slot2_provider }

      nextRoundMatches.push({
        tournament_id: tournamentId,
        round_number: nextRound,
        match_number: Math.floor(i / 2) + 1,
        slot1_name: winner1.name,
        slot1_provider: winner1.provider,
        slot2_name: winner2.name,
        slot2_provider: winner2.provider,
        status: "pending",
      })
    }

    if (nextRoundMatches.length > 0) {
      await supabase.from("tournament_matches").insert(nextRoundMatches)
    }

    // If only one match in next round, it's the final
    if (nextRoundMatches.length === 1) {
      // Check if final is completed to mark tournament as completed
      const { data: finalMatch } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round_number", nextRound)
        .single()

      if (finalMatch?.status === "completed") {
        await supabase.from("tournaments").update({ status: "completed" }).eq("id", tournamentId)
      }
    }
  }

  const getRoundName = (roundNumber: number, totalRounds: number) => {
    if (roundNumber === totalRounds) return "Final"
    if (roundNumber === totalRounds - 1) return "Semi-Finals"
    return `Round ${roundNumber}`
  }

  const matchesByRound = matches.reduce(
    (acc, match) => {
      if (!acc[match.round_number]) acc[match.round_number] = []
      acc[match.round_number].push(match)
      return acc
    },
    {} as Record<number, Match[]>,
  )

  const totalRounds = Math.max(...Object.keys(matchesByRound).map(Number), 0)

  if (loading) {
    return <div className="p-8 text-white">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => router.push("/admin/tournaments")}
            variant="outline"
            className="mb-4 border-slate-700 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tournaments
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">{tournament?.title}</h1>
                  <p className="text-slate-400">Tournament Bracket Management</p>
                </div>
              </div>
            </div>

            {matches.length === 0 && (
              <Button
                onClick={startTournament}
                disabled={starting}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
              >
                <Play className="w-4 h-4 mr-2" />
                {starting ? "Starting..." : "Start Tournament"}
              </Button>
            )}
          </div>
        </div>

        {/* Bracket View */}
        {matches.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Tournament Not Started</h3>
            <p className="text-slate-400">Click "Start Tournament" to generate the bracket with 8 random slots</p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-8">
            {Object.keys(matchesByRound)
              .sort((a, b) => Number(a) - Number(b))
              .map((roundNum) => {
                const roundNumber = Number(roundNum)
                const roundMatches = matchesByRound[roundNumber]

                return (
                  <div key={roundNumber} className="space-y-4">
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg p-3 text-center">
                      <h3 className="text-white font-bold">{getRoundName(roundNumber, totalRounds)}</h3>
                    </div>

                    {roundMatches.map((match) => (
                      <Card key={match.id} className="bg-slate-800/50 border-slate-700/50 p-4 space-y-3">
                        <div className="text-xs text-slate-500 font-medium">Match #{match.match_number}</div>

                        {/* Slot 1 */}
                        <div
                          className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                            match.winner_slot === 1
                              ? "bg-green-500/20 border-green-500"
                              : match.winner_slot === 2
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-slate-900/50 border-slate-700 hover:border-cyan-500/50"
                          }`}
                          onClick={() => match.status === "pending" && setWinner(match.id, 1, match)}
                        >
                          <div className="text-green-400 font-bold text-sm">{match.slot1_name}</div>
                          <div className="text-slate-400 text-xs">({match.slot1_provider})</div>
                          {match.winner_slot === 1 && (
                            <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">Winner</Badge>
                          )}
                          {match.winner_slot === 2 && (
                            <Badge className="mt-2 bg-red-500/20 text-red-400 border-red-500/30">Loser</Badge>
                          )}
                        </div>

                        {/* Slot 2 */}
                        <div
                          className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                            match.winner_slot === 2
                              ? "bg-green-500/20 border-green-500"
                              : match.winner_slot === 1
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-slate-900/50 border-slate-700 hover:border-cyan-500/50"
                          }`}
                          onClick={() => match.status === "pending" && setWinner(match.id, 2, match)}
                        >
                          <div className="text-green-400 font-bold text-sm">{match.slot2_name}</div>
                          <div className="text-slate-400 text-xs">({match.slot2_provider})</div>
                          {match.winner_slot === 2 && (
                            <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">Winner</Badge>
                          )}
                          {match.winner_slot === 1 && (
                            <Badge className="mt-2 bg-red-500/20 text-red-400 border-red-500/30">Loser</Badge>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
