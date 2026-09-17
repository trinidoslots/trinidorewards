"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useTournamentLive } from "@/hooks/use-tournament-live"
import { BRACKET, BracketMatchCard } from "@/components/obs/tournament-cards"
import { PREVIEW_TOURNAMENT } from "@/lib/tournament-preview"
import { matchesInRound, roundCount, roundLabel } from "@/lib/tournament"

/** Width of the gutter each round after the first reserves for its connectors. */
const GUTTER = 44

/**
 * The whole bracket, for a wide OBS source.
 *
 * Every round is a column and every match in a column gets an equal share of
 * the height, so a round-2 match sits exactly level with the midpoint of the
 * two round-1 matches that feed it. That is what lets the connector elbows be
 * drawn from percentages instead of measured pixel positions — no layout
 * observers, and it stays correct at any source size.
 *
 * ?id=<uuid> pins it to one tournament; without it the newest battle is
 * followed, including after the final so the finished bracket stays up.
 * ?preview=1 renders a sample bracket for positioning off-stream.
 */
function BracketPanel() {
  const searchParams = useSearchParams()
  const isPreview = searchParams.get("preview") === "1"
  const pinned = searchParams.get("id")?.trim() || undefined

  const live = useTournamentLive({ id: pinned, enabled: !isPreview })
  const { tournament, participants, matches } = isPreview ? PREVIEW_TOURNAMENT : live

  const size = tournament?.bracket_size ?? 0

  // Nothing rather than an empty frame: a source that renders a blank card
  // looks broken on stream, a transparent one simply is not there.
  if (!tournament || matches.length === 0 || !size) {
    return <div className="h-screen w-full bg-transparent" />
  }

  const byId = new Map(participants.map((participant) => [participant.id, participant]))
  const total = roundCount(size)
  const rounds = Array.from({ length: total }, (_, index) => index + 1)

  return (
    <div className="h-screen w-full bg-transparent">
      <div
        className="flex h-full w-full gap-0 overflow-hidden rounded-xl p-4"
        style={{ backgroundColor: "#0B0B0D" }}
      >
        {rounds.map((round) => {
          const count = matchesInRound(round, size)
          const inRound = matches
            .filter((match) => match.round_number === round)
            .sort((a, b) => a.match_number - b.match_number)
          const isFinal = round === total

          return (
            <section key={round} className="flex min-w-0 flex-1 flex-col">
              <header className="pb-2 text-center">
                <p
                  className="text-[13px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: isFinal ? BRACKET.gold : BRACKET.spine }}
                >
                  {roundLabel(round, size)}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: BRACKET.muted }}>
                  {count} {count === 1 ? "Match" : "Matches"}
                </p>
              </header>
              <div
                className="mb-2 h-px"
                style={{ marginLeft: round > 1 ? GUTTER : 0, backgroundColor: BRACKET.cardBorder }}
              />

              <div className="flex min-h-0 flex-1 flex-col">
                {inRound.map((match) => (
                  <div
                    key={match.id}
                    className="relative flex min-h-0 flex-1 items-center"
                    style={{ paddingLeft: round > 1 ? GUTTER : 0 }}
                  >
                    {round > 1 && <Connector />}
                    <BracketMatchCard
                      match={match}
                      p1={match.p1_id ? byId.get(match.p1_id) ?? null : null}
                      p2={match.p2_id ? byId.get(match.p2_id) ?? null : null}
                      gold={isFinal}
                    />
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The elbow joining two matches of the previous round to this one: a stub out
 * of each feeder at 25% and 75% of this slot's height, a spine between them,
 * and one stub into this card at the midpoint.
 */
function Connector() {
  const spine = { position: "absolute" as const, backgroundColor: BRACKET.spine }
  return (
    <>
      <span style={{ ...spine, left: 0, top: "25%", width: GUTTER / 2, height: 2 }} />
      <span style={{ ...spine, left: 0, top: "75%", width: GUTTER / 2, height: 2 }} />
      <span style={{ ...spine, left: GUTTER / 2, top: "25%", width: 2, height: "50%" }} />
      <span style={{ ...spine, left: GUTTER / 2, top: "50%", width: GUTTER / 2, height: 2 }} />
    </>
  )
}

export default function TournamentOverviewObsPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-transparent" />}>
      <BracketPanel />
    </Suspense>
  )
}
