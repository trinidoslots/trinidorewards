"use client"

import { Crown } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { money, multiplier, roundCount, roundLabel, type Match, type Participant } from "@/lib/tournament"

/**
 * The bracket as columns of matches, one column per round.
 *
 * Laid out as a plain flex row rather than with connector lines: the seeding
 * already guarantees that match n and n+1 of a round feed the same match of the
 * next, so the vertical order carries the same information that drawn lines
 * would, and it survives a narrow admin panel.
 *
 * Without `onEnterResult` it is read-only, which is how the public tournament
 * page uses it — the same bracket with no way to touch the results.
 */
export function TournamentBracketBoard({
  size,
  matches,
  participants,
  onEnterResult,
}: {
  size: number
  matches: Match[]
  participants: Participant[]
  onEnterResult?: (match: Match) => void
}) {
  const byId = new Map(participants.map((participant) => [participant.id, participant]))
  const rounds = Array.from({ length: roundCount(size) }, (_, index) => index + 1)

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {rounds.map((round) => {
        const inRound = matches
          .filter((match) => match.round_number === round)
          .sort((a, b) => a.match_number - b.match_number)

        return (
          <section key={round} className="flex min-w-[240px] flex-1 flex-col gap-2">
            <MonoLabel className="px-0.5 text-white/35">{roundLabel(round, size)}</MonoLabel>

            {inRound.map((match) => {
              const p1 = match.p1_id ? byId.get(match.p1_id) ?? null : null
              const p2 = match.p2_id ? byId.get(match.p2_id) ?? null : null
              const playable = !!onEnterResult && !!p1 && !!p2 && !match.winner_participant_id
              const done = !!match.winner_participant_id

              return (
                <article
                  key={match.id}
                  className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.022]"
                  style={done ? { borderColor: `${ACCENTS.green}33` } : undefined}
                >
                  <Side match={match} side={1} participant={p1} />
                  <div className="h-px bg-white/[0.06]" />
                  <Side match={match} side={2} participant={p2} />

                  {playable && (
                    <button
                      type="button"
                      onClick={() => onEnterResult?.(match)}
                      className="w-full border-t border-white/[0.08] py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Enter results
                    </button>
                  )}
                  {done && onEnterResult && (
                    <button
                      type="button"
                      onClick={() => onEnterResult?.(match)}
                      className="w-full border-t border-white/[0.06] py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/20 transition hover:bg-white/[0.05] hover:text-white/60"
                    >
                      Edit
                    </button>
                  )}
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

function Side({
  match,
  side,
  participant,
}: {
  match: Match
  side: 1 | 2
  participant: Participant | null
}) {
  const payout = side === 1 ? match.p1_payout : match.p2_payout
  const won = !!participant && match.winner_participant_id === participant.id
  const lost = !!match.winner_participant_id && !won

  if (!participant) {
    return (
      <div className="px-3 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/15">Awaiting winner</span>
      </div>
    )
  }

  const times = multiplier(payout === null ? null : Number(payout), Number(participant.buy_amount))

  return (
    <div className={`px-3 py-2 transition ${lost ? "opacity-40" : ""}`}>
      <div className="flex items-baseline gap-1.5">
        {won && <Crown className="h-3 w-3 shrink-0 self-center" style={{ color: ACCENTS.green }} />}
        <span className="truncate text-[13px] font-medium text-white">{participant.username}</span>
        {participant.is_super && <MonoLabel style={{ color: ACCENTS.amber }}>S</MonoLabel>}
        <span className="ml-auto shrink-0 text-[12px] tabular-nums text-white/70">
          {payout === null ? <span className="text-white/20">—</span> : money(Number(payout))}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="truncate text-[11px] text-white/30">{participant.game_name ?? "No slot"}</span>
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums" style={{ color: ACCENTS.blue }}>
          {times === null ? "" : `${times.toFixed(2)}x`}
        </span>
      </div>
    </div>
  )
}
