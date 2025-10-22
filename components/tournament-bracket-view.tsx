"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

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

interface Tournament {
  id: string
  title: string
  description: string
  status: string
}

export default function TournamentBracketView({
  tournament,
  matches,
}: {
  tournament: Tournament
  matches: Match[]
}) {
  const router = useRouter()

  const matchesByRound = matches.reduce(
    (acc, match) => {
      if (!acc[match.round_number]) acc[match.round_number] = []
      acc[match.round_number].push(match)
      return acc
    },
    {} as Record<number, Match[]>,
  )

  const totalRounds = Math.max(...Object.keys(matchesByRound).map(Number), 0)

  const getRoundName = (roundNumber: number, totalRounds: number) => {
    if (roundNumber === totalRounds) return "Round 3"
    if (roundNumber === 2) return "Round 2"
    return "Round 1"
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => router.push("/tournaments")}
            variant="outline"
            className="mb-6 border-slate-700 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>

          <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-cyan-500/20 rounded-2xl p-8 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-sm px-3 py-1">
                VOTE & COMPETE
              </Badge>
            </div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
              {tournament.title}
            </h1>
            {tournament.description && <p className="text-slate-400 text-lg">{tournament.description}</p>}
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-3 mb-6">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">
              <Trophy className="w-4 h-4 mr-2" />
              Bracket
            </Button>
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800 bg-transparent" disabled>
              Predictions
            </Button>
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800 bg-transparent" disabled>
              My Prediction
            </Button>
          </div>
        </div>

        {/* Bracket Grid */}
        {matches.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Tournament Not Started</h3>
            <p className="text-slate-400">The bracket will appear here once the tournament begins</p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {Object.keys(matchesByRound)
              .sort((a, b) => Number(a) - Number(b))
              .map((roundNum) => {
                const roundNumber = Number(roundNum)
                const roundMatches = matchesByRound[roundNumber]

                return (
                  <div key={roundNumber} className="space-y-4">
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg p-4 text-center">
                      <h3 className="text-white font-bold text-lg">{getRoundName(roundNumber, totalRounds)}</h3>
                    </div>

                    {roundMatches.map((match) => (
                      <Card key={match.id} className="bg-slate-800/50 border-slate-700/50 p-4 space-y-2">
                        <div className="text-xs text-slate-500 font-medium mb-3">Match #{match.match_number}</div>

                        {/* Slot 1 */}
                        <div
                          className={`p-3 rounded-lg border-2 ${
                            match.winner_slot === 1
                              ? "bg-green-500/20 border-green-500"
                              : match.winner_slot === 2
                                ? "bg-slate-900/30 border-red-500/30"
                                : "bg-slate-900/50 border-slate-700"
                          }`}
                        >
                          <div className="text-green-400 font-bold text-sm mb-1">{match.slot1_name}</div>
                          <div className="text-slate-400 text-xs">({match.slot1_provider})</div>
                          {match.winner_slot === 1 && (
                            <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                              Winner
                            </Badge>
                          )}
                          {match.winner_slot === 2 && (
                            <Badge className="mt-2 bg-red-500/20 text-red-400 border-red-500/30 text-xs">Loser</Badge>
                          )}
                        </div>

                        {/* Slot 2 */}
                        <div
                          className={`p-3 rounded-lg border-2 ${
                            match.winner_slot === 2
                              ? "bg-green-500/20 border-green-500"
                              : match.winner_slot === 1
                                ? "bg-slate-900/30 border-red-500/30"
                                : "bg-slate-900/50 border-slate-700"
                          }`}
                        >
                          <div className="text-green-400 font-bold text-sm mb-1">{match.slot2_name}</div>
                          <div className="text-slate-400 text-xs">({match.slot2_provider})</div>
                          {match.winner_slot === 2 && (
                            <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                              Winner
                            </Badge>
                          )}
                          {match.winner_slot === 1 && (
                            <Badge className="mt-2 bg-red-500/20 text-red-400 border-red-500/30 text-xs">Loser</Badge>
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
