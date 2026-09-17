"use client"

import React, { useMemo } from "react"
import { Card } from "@/components/ui/card"

interface BracketSlot {
  slot_position: number
  participant_name: string
  admin_note: string
  winner?: boolean
}

interface BracketVisualizerProps {
  slots: BracketSlot[]
  maxParticipants: number
  isInteractive?: boolean
  onSlotClick?: (slotNumber: number) => void
}

export function BracketVisualizer({
  slots,
  maxParticipants,
  isInteractive = false,
  onSlotClick,
}: BracketVisualizerProps) {
  // Calculate number of rounds needed
  const numRounds = useMemo(() => {
    let rounds = 0
    let participants = maxParticipants
    while (participants > 1) {
      rounds++
      participants /= 2
    }
    return rounds
  }, [maxParticipants])

  // Build bracket structure
  const bracketRounds = useMemo(() => {
    const rounds: BracketSlot[][][] = []

    // First round - all participants
    const firstRound: BracketSlot[][] = []
    for (let i = 0; i < maxParticipants; i += 2) {
      const participant1 = slots.find((s) => s.slot_position === i + 1)
      const participant2 = slots.find((s) => s.slot_position === i + 2)

      firstRound.push([
        participant1 || {
          slot_position: i + 1,
          participant_name: `Slot ${i + 1}`,
          admin_note: "",
        },
        participant2 || {
          slot_position: i + 2,
          participant_name: `Slot ${i + 2}`,
          admin_note: "",
        },
      ])
    }

    rounds.push(firstRound)

    // Subsequent rounds (simplified representation)
    for (let round = 1; round < numRounds; round++) {
      const currentRoundSize = firstRound.length / Math.pow(2, round)
      const nextRound: BracketSlot[][] = []

      for (let i = 0; i < currentRoundSize; i++) {
        nextRound.push([
          {
            slot_position: 0,
            participant_name: "Winner",
            admin_note: "",
          },
          {
            slot_position: 0,
            participant_name: "Winner",
            admin_note: "",
          },
        ])
      }

      rounds.push(nextRound)
    }

    return rounds
  }, [slots, maxParticipants, numRounds])

  return (
    <div className="w-full overflow-x-auto bg-slate-900/30 rounded-lg border border-slate-700/50 p-6">
      <div className="flex gap-8 min-w-full justify-start">
        {bracketRounds.map((round, roundIndex) => (
          <div key={roundIndex} className="flex flex-col justify-center gap-4 min-w-max">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              {roundIndex === 0 && "Round 1"}
              {roundIndex === bracketRounds.length - 1 && roundIndex > 0 && "Finals"}
              {roundIndex > 0 && roundIndex < bracketRounds.length - 1 && `Round ${roundIndex + 1}`}
            </div>

            <div className="flex flex-col gap-4 justify-center">
              {round.map((matchup, matchupIndex) => (
                <div key={matchupIndex} className="flex flex-col gap-2">
                  {matchup.map((participant, participantIndex) => (
                    <Card
                      key={`${matchupIndex}-${participantIndex}`}
                      onClick={() => isInteractive && onSlotClick?.(participant.slot_position)}
                      className={`
                        w-56 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg
                        ${isInteractive ? "cursor-pointer hover:border-cyan-500/50 transition-colors" : ""}
                        ${participant.winner ? "border-green-500/50 bg-green-500/10" : ""}
                      `}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-white text-sm line-clamp-1">
                          {participant.participant_name || "—"}
                        </div>
                        {participant.admin_note && (
                          <div className="text-xs text-slate-400 line-clamp-2">{participant.admin_note}</div>
                        )}
                        {!participant.participant_name && (
                          <div className="text-xs text-slate-500 italic">Empty slot</div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
