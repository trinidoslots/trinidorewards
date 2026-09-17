"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Trophy } from "lucide-react"
import { currentMatch, useTournamentLive } from "@/hooks/use-tournament-live"
import { BRACKET, RoundMatchCard } from "@/components/obs/tournament-cards"
import { PREVIEW_TOURNAMENT } from "@/lib/tournament-preview"

/**
 * The match being opened right now, as a single card.
 *
 * "Right now" is the first match in bracket order with both players known and
 * no winner entered — exactly the match the console offers an Enter Results
 * button for, so the overlay and the admin can never point at different games.
 *
 * ?id=<uuid> pins it to one tournament, ?preview=1 renders a sample match.
 */
function RoundPanel() {
  const searchParams = useSearchParams()
  const isPreview = searchParams.get("preview") === "1"
  const pinned = searchParams.get("id")?.trim() || undefined

  const live = useTournamentLive({ id: pinned, enabled: !isPreview })
  const { tournament, participants, matches } = isPreview ? PREVIEW_TOURNAMENT : live

  const match = currentMatch(matches)
  const byId = new Map(participants.map((participant) => [participant.id, participant]))
  const champion = tournament?.champion_participant_id ? byId.get(tournament.champion_participant_id) ?? null : null

  if (!tournament || (!match && !champion)) {
    return <div className="h-screen w-full bg-transparent" />
  }

  return (
    <div className="h-screen w-full bg-transparent">
      <div className="flex h-full w-full items-center p-1">
        <AnimatePresence mode="wait">
          {match ? (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full"
            >
              <RoundMatchCard
                match={match}
                p1={match.p1_id ? byId.get(match.p1_id) ?? null : null}
                p2={match.p2_id ? byId.get(match.p2_id) ?? null : null}
              />
            </motion.div>
          ) : (
            <motion.div
              key="champion"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-3"
              style={{
                backgroundColor: BRACKET.goldFill,
                border: "1px solid " + BRACKET.goldBorder,
                borderLeft: "2px solid " + BRACKET.gold,
              }}
            >
              <Trophy className="h-5 w-5 shrink-0" style={{ color: BRACKET.gold }} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: BRACKET.gold }}>
                  Champion
                </p>
                <p className="truncate text-[15px] font-bold leading-tight" style={{ color: BRACKET.text }}>
                  {champion?.username ?? tournament.winner_username ?? "—"}
                </p>
                <p className="truncate text-[11px] leading-tight" style={{ color: BRACKET.muted }}>
                  {champion?.game_name ?? "No slot recorded"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function TournamentRoundObsPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-transparent" />}>
      <RoundPanel />
    </Suspense>
  )
}
