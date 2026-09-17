"use client"

import { Check, Swords, Trophy } from "lucide-react"
import { useTournamentLive, currentMatch, type TournamentSnapshot } from "@/hooks/use-tournament-live"
import { RoundMatchCard, STREAM_BRACKET } from "@/components/obs/tournament-cards"
import { OBS, OBS_RADIUS } from "@/lib/obs-theme"
import { multiplier, roundCount, roundLabel, tournamentTotals, type Match } from "@/lib/tournament"

/**
 * A finished battle stays on the event column this long before it drops off,
 * so the champion is seen without the card sitting there until the next one.
 */
const CHAMPION_LINGER_MS = 10 * 60_000

/**
 * The tournament, as one card in the stream column.
 *
 * Exists so the dedicated bracket and round sources do not have to be on the
 * scene all the time: while a battle is running this shows what is being opened
 * and how the round is going, and when nothing is running it is not there.
 */
export function useTournamentEvent(
  { enabled = true }: { enabled?: boolean } = {},
): TournamentSnapshot & { visible: boolean; startedAt: number } {
  const snapshot = useTournamentLive({ enabled })
  const { tournament, matches } = snapshot

  const running = tournament?.bracket_status === "running"
  const finishedAt = tournament?.finished_at ? Date.parse(tournament.finished_at) : NaN
  const recentlyFinished = Number.isFinite(finishedAt) && Date.now() - finishedAt < CHAMPION_LINGER_MS

  // Ordered by the last result entered rather than by when the tournament
  // started: every match that is decided is a real event, so the card earning
  // its way back to the top of the column is the behaviour wanted here. (The
  // giveaway is deliberately the opposite — its row is touched by every entry.)
  const lastPlayed = matches.reduce((latest, match) => {
    const at = match.played_at ? Date.parse(match.played_at) : NaN
    return Number.isFinite(at) && at > latest ? at : latest
  }, 0)
  const startedFallback = tournament?.started_at ? Date.parse(tournament.started_at) : NaN

  return {
    ...snapshot,
    visible: !!tournament && (running || recentlyFinished),
    startedAt: lastPlayed || (Number.isFinite(startedFallback) ? startedFallback : 0),
  }
}

export function TournamentEventCard({ snapshot }: { snapshot: TournamentSnapshot }) {
  const { tournament, participants, matches } = snapshot
  if (!tournament) return null

  const size = tournament.bracket_size ?? 0
  const byId = new Map(participants.map((participant) => [participant.id, participant]))
  const match = currentMatch(matches)
  const totals = tournamentTotals(participants, matches, size || 1)
  const champion = tournament.champion_participant_id ? byId.get(tournament.champion_participant_id) ?? null : null

  // The round on show is the one still being played, or the last one.
  const open = matches.filter((entry) => !entry.winner_participant_id).map((entry) => entry.round_number)
  const round = open.length > 0 ? Math.min(...open) : Math.max(1, roundCount(size || 2))
  const inRound = matches
    .filter((entry) => entry.round_number === round)
    .sort((a, b) => a.match_number - b.match_number)

  return (
    // Same shell as the other event tiles — surface, hairline, radius and the
    // 36px icon tile — so this reads as one of the column's cards rather than a
    // bracket that happens to be parked in it.
    <div
      className="w-full overflow-hidden border shadow-lg"
      style={{
        backgroundColor: OBS.card,
        borderColor: OBS.cardBorder,
        borderRadius: OBS_RADIUS.card,
      }}
    >
      <header className="flex items-center gap-3 px-3 pb-2 pt-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ backgroundColor: OBS.iconTile, borderRadius: OBS_RADIUS.iconTile }}
        >
          <Swords className="h-5 w-5" style={{ color: OBS.label }} />
        </div>
        <span
          className="truncate text-[11px] font-bold uppercase tracking-[0.10em]"
          style={{ color: OBS.label }}
        >
          {size ? roundLabel(round, size) : "Bonus Battle"}
        </span>
        <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums" style={{ color: OBS.muted }}>
          {totals.matchesPlayed}/{totals.matchesTotal}
        </span>
      </header>

      {champion ? (
        <div className="flex items-center gap-2 px-3 pb-2.5">
          <Trophy className="h-4 w-4 shrink-0" style={{ color: OBS.cashout }} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.10em]" style={{ color: OBS.cashout }}>
              Champion
            </p>
            <p className="truncate text-[20px] font-extrabold leading-tight" style={{ color: OBS.value }}>
              {champion.username}
            </p>
          </div>
        </div>
      ) : (
        match && (
          <div className="px-3 pb-2.5">
            <RoundMatchCard
              match={match}
              p1={match.p1_id ? byId.get(match.p1_id) ?? null : null}
              p2={match.p2_id ? byId.get(match.p2_id) ?? null : null}
              palette={STREAM_BRACKET}
            />
          </div>
        )
      )}

      <ul style={{ borderTop: "1px solid " + OBS.cardBorder }}>
        {inRound.map((entry) => (
          <RoundLine key={entry.id} match={entry} byId={byId} live={entry.id === match?.id} />
        ))}
      </ul>
    </div>
  )
}

/** One line of the round: who took it and at what multiple, or that it is next. */
function RoundLine({
  match,
  byId,
  live,
}: {
  match: Match
  byId: Map<string, { id: string; username: string; buy_amount: number }>
  live: boolean
}) {
  const winner = match.winner_participant_id ? byId.get(match.winner_participant_id) ?? null : null
  const payout = winner && match.p1_id === winner.id ? match.p1_payout : match.p2_payout
  const times = winner ? multiplier(payout === null ? null : Number(payout), Number(winner.buy_amount)) : null

  return (
    <li className="flex items-center gap-2 px-3 py-[5px] text-[11px]">
      <span className="w-4 shrink-0 tabular-nums" style={{ color: OBS.muted }}>
        M{match.match_number}
      </span>
      {winner ? (
        <>
          <Check className="h-3 w-3 shrink-0" style={{ color: OBS.cashout }} />
          <span className="truncate" style={{ color: OBS.value }}>
            {winner.username}
          </span>
          <span className="ml-auto shrink-0 tabular-nums" style={{ color: OBS.cashout }}>
            {times === null ? "" : times.toFixed(2) + "x"}
          </span>
        </>
      ) : (
        <span style={{ color: live ? OBS.label : OBS.muted }}>
          {live ? "Opening now" : match.p1_id && match.p2_id ? "Up next" : "Awaiting winners"}
        </span>
      )}
    </li>
  )
}
