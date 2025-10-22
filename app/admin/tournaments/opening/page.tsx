"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Trophy, Play, RotateCcw, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Tournament {
  id: string
  title: string
  status: string
  prize_pool: number
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

export default function TournamentOpeningPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchActiveTournament()
    fetchAllSlots()
  }, [])

  async function fetchActiveTournament() {
    const { data } = await supabase
      .from("tournaments")
      .select("id, title, status, prize_pool")
      .eq("status", "active")
      .single()

    if (data) {
      setTournament(data)
      await fetchMatches(data.id)
    }
    setLoading(false)
  }

  async function fetchMatches(tournamentId: string) {
    const { data } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round_number")
      .order("match_number")

    if (data) {
      setMatches(data)
      // Find first pending match
      const firstPending = data.findIndex((m) => m.status === "pending")
      if (firstPending !== -1) {
        setCurrentMatchIndex(firstPending)
      }
    }
  }

  async function fetchAllSlots() {
    const { data } = await supabase.from("slots").select("game_name, provider").order("game_name")

    if (data) setAllSlots(data)
  }

  async function startTournament() {
    if (selectedSlots.length !== 8) {
      alert("Please select exactly 8 slots to start the tournament")
      return
    }

    setStarting(true)
    try {
      // Create Round 1 matches (4 matches)
      const round1Matches = []
      for (let i = 0; i < 4; i++) {
        round1Matches.push({
          tournament_id: tournament!.id,
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

      await fetchMatches(tournament!.id)
      setSelectedSlots([])
    } catch (error) {
      console.error("Error starting tournament:", error)
      alert("Failed to start tournament")
    } finally {
      setStarting(false)
    }
  }

  async function setWinner(winnerSlot: number) {
    const currentMatch = matches[currentMatchIndex]
    if (!currentMatch) return

    try {
      // Update match winner
      await supabase
        .from("tournament_matches")
        .update({
          winner_slot: winnerSlot,
          status: "completed",
        })
        .eq("id", currentMatch.id)

      // Check if all matches in current round are completed
      const currentRound = currentMatch.round_number
      const roundMatches = matches.filter((m) => m.round_number === currentRound)
      const allCompleted = roundMatches.every((m) => (m.id === currentMatch.id ? true : m.status === "completed"))

      if (allCompleted) {
        await createNextRound(currentRound, roundMatches)
      }

      await fetchMatches(tournament!.id)

      // Move to next pending match
      const nextPending = matches.findIndex((m, idx) => idx > currentMatchIndex && m.status === "pending")
      if (nextPending !== -1) {
        setCurrentMatchIndex(nextPending)
      }
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
        tournament_id: tournament!.id,
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
    if (nextRoundMatches.length === 1 && nextRoundMatches[0].status === "completed") {
      await supabase.from("tournaments").update({ status: "completed" }).eq("id", tournament!.id)
    }
  }

  async function resetTournament() {
    if (
      !confirm("Are you sure you want to reset this tournament? This will delete all matches and reset the tournament.")
    )
      return

    try {
      // Delete all matches
      await supabase.from("tournament_matches").delete().eq("tournament_id", tournament!.id)

      // Reset tournament status
      await supabase.from("tournaments").update({ status: "registration" }).eq("id", tournament!.id)

      router.push("/admin/tournaments")
    } catch (error) {
      console.error("Error resetting tournament:", error)
      alert("Failed to reset tournament")
    }
  }

  const toggleSlotSelection = (slot: Slot) => {
    const isSelected = selectedSlots.some((s) => s.game_name === slot.game_name && s.provider === slot.provider)

    if (isSelected) {
      setSelectedSlots(selectedSlots.filter((s) => !(s.game_name === slot.game_name && s.provider === slot.provider)))
    } else {
      if (selectedSlots.length < 8) {
        setSelectedSlots([...selectedSlots, slot])
      }
    }
  }

  const filteredSlots = allSlots.filter(
    (slot) =>
      slot.game_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slot.provider.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getRoundName = (roundNumber: number) => {
    const maxRound = Math.max(...matches.map((m) => m.round_number))
    if (roundNumber === maxRound && maxRound === 3) return "Final"
    if (roundNumber === maxRound - 1 && maxRound === 3) return "Semi-Finals"
    return `Round ${roundNumber}`
  }

  const currentMatch = matches[currentMatchIndex]
  const isCompleted = matches.length > 0 && matches.every((m) => m.status === "completed")

  if (loading) {
    return <div className="p-8 text-white">Loading...</div>
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <Button
            onClick={() => router.push("/admin/tournaments")}
            variant="outline"
            className="mb-4 border-slate-700 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tournaments
          </Button>
          <Card className="bg-slate-800/50 border-slate-700/50 p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Active Tournament</h3>
            <p className="text-slate-400">Create and activate a tournament first</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push("/admin/tournaments")}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">{tournament.title}</h1>
              <p className="text-slate-400">Tournament Opening Mode</p>
            </div>
          </div>
          {isCompleted && (
            <Button
              onClick={resetTournament}
              variant="outline"
              className="border-red-500/20 hover:bg-red-500/10 text-red-400 bg-transparent"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Tournament
            </Button>
          )}
        </div>

        {/* Setup Phase */}
        {matches.length === 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Slot Selection */}
            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Select 8 Slots</h3>
              <div className="space-y-4">
                <Input
                  placeholder="Search slots..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white"
                />
                <div className="text-sm text-slate-400">Selected: {selectedSlots.length}/8</div>
                <div className="max-h-[500px] overflow-y-auto space-y-2">
                  {filteredSlots.map((slot, idx) => {
                    const isSelected = selectedSlots.some(
                      (s) => s.game_name === slot.game_name && s.provider === slot.provider,
                    )
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleSlotSelection(slot)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-cyan-500/20 border-cyan-500"
                            : "bg-slate-900/50 border-slate-700 hover:border-cyan-500/50"
                        }`}
                      >
                        <div className="text-white font-semibold">{slot.game_name}</div>
                        <div className="text-slate-400 text-sm">{slot.provider}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>

            {/* Selected Slots */}
            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Tournament Bracket</h3>
              <div className="space-y-4">
                {selectedSlots.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    Select 8 slots to create the tournament bracket
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {selectedSlots.map((slot, idx) => (
                        <div key={idx} className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-white font-semibold">{slot.game_name}</div>
                              <div className="text-slate-400 text-sm">{slot.provider}</div>
                            </div>
                            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">#{idx + 1}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={startTournament}
                      disabled={selectedSlots.length !== 8 || starting}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {starting ? "Starting..." : "Start Tournament"}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Opening Mode */}
        {matches.length > 0 && !isCompleted && currentMatch && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Current Match */}
            <Card className="md:col-span-2 bg-slate-800/50 border-slate-700/50 p-8">
              <div className="text-center mb-6">
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-lg px-4 py-2">
                  {getRoundName(currentMatch.round_number)} - Match #{currentMatch.match_number}
                </Badge>
              </div>

              <div className="space-y-6">
                {/* Slot 1 */}
                <div
                  onClick={() => setWinner(1)}
                  className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-slate-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all group"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">{currentMatch.slot1_name}</div>
                    <div className="text-slate-400 text-lg">({currentMatch.slot1_provider})</div>
                    <Button className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Check className="w-4 h-4 mr-2" />
                      Select Winner
                    </Button>
                  </div>
                </div>

                <div className="text-center text-slate-500 font-bold text-xl">VS</div>

                {/* Slot 2 */}
                <div
                  onClick={() => setWinner(2)}
                  className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-slate-700 hover:border-cyan-500 rounded-xl cursor-pointer transition-all group"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-2">{currentMatch.slot2_name}</div>
                    <div className="text-slate-400 text-lg">({currentMatch.slot2_provider})</div>
                    <Button className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Check className="w-4 h-4 mr-2" />
                      Select Winner
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Match List */}
            <Card className="bg-slate-800/50 border-slate-700/50 p-6">
              <h3 className="text-xl font-bold text-white mb-4">All Matches</h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {matches.map((match, idx) => (
                  <div
                    key={match.id}
                    onClick={() => match.status === "pending" && setCurrentMatchIndex(idx)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      idx === currentMatchIndex
                        ? "bg-cyan-500/20 border-cyan-500"
                        : match.status === "completed"
                          ? "bg-green-500/10 border-green-500/30"
                          : "bg-slate-900/50 border-slate-700 hover:border-cyan-500/50"
                    }`}
                  >
                    <div className="text-xs text-slate-400 mb-1">
                      {getRoundName(match.round_number)} - Match #{match.match_number}
                    </div>
                    <div className="space-y-1">
                      <div className={`text-sm ${match.winner_slot === 1 ? "text-green-400 font-bold" : "text-white"}`}>
                        {match.slot1_name}
                        {match.winner_slot === 1 && <Check className="w-3 h-3 inline ml-1" />}
                      </div>
                      <div className={`text-sm ${match.winner_slot === 2 ? "text-green-400 font-bold" : "text-white"}`}>
                        {match.slot2_name}
                        {match.winner_slot === 2 && <Check className="w-3 h-3 inline ml-1" />}
                      </div>
                    </div>
                    {match.status === "completed" && (
                      <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                        Completed
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Completed State */}
        {isCompleted && (
          <Card className="bg-slate-800/50 border-slate-700/50 p-12 text-center">
            <Trophy className="w-24 h-24 text-amber-400 mx-auto mb-6" />
            <h2 className="text-4xl font-bold text-white mb-4">Tournament Complete!</h2>
            <p className="text-slate-400 text-lg mb-8">
              Winner:{" "}
              {matches[matches.length - 1]?.winner_slot === 1
                ? matches[matches.length - 1]?.slot1_name
                : matches[matches.length - 1]?.slot2_name}
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => router.push("/admin/tournaments")}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
              >
                Back to Tournaments
              </Button>
              <Button
                onClick={resetTournament}
                variant="outline"
                className="border-red-500/20 hover:bg-red-500/10 text-red-400 bg-transparent"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Tournament
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
