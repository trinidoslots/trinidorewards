"use client"

import { Crown, ImageIcon } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { multiColor } from "@/components/hunt-kpi-board"
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
 *
 * Once the final has a winner, a champion card closes the row of rounds.
 */

/** The gold the site uses for a big win. */
const GOLD = "#F5C542"
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
  const final = matches.find((match) => match.round_number === rounds.length && match.winner_participant_id)
  const champion = final?.winner_participant_id ? byId.get(final.winner_participant_id) ?? null : null

  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {rounds.map((round) => {
        const inRound = matches
          .filter((match) => match.round_number === round)
          .sort((a, b) => a.match_number - b.match_number)

        return (
          // Heading on top, matches beneath in a body that every column shares
          // the height of: the rounds stretch to the tallest, so spacing the
          // matches around their body puts each one level with the middle of
          // the pair that feeds it. The heading sits outside that body, or it
          // would be spaced down with the matches.
          <section key={round} className="flex min-w-[250px] flex-1 flex-col gap-3">
            <div className="flex items-baseline justify-between px-0.5">
              <MonoLabel className="text-white/55">{roundLabel(round, size)}</MonoLabel>
              <MonoLabel className="text-white/25">
                {inRound.length} {inRound.length === 1 ? "match" : "matches"}
              </MonoLabel>
            </div>

            <div className="flex flex-1 flex-col justify-around gap-3">
            {inRound.map((match) => {
              const p1 = match.p1_id ? byId.get(match.p1_id) ?? null : null
              const p2 = match.p2_id ? byId.get(match.p2_id) ?? null : null
              const playable = !!onEnterResult && !!p1 && !!p2 && !match.winner_participant_id
              const done = !!match.winner_participant_id

              return (
                <article
                  key={match.id}
                  className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0E0E12]"
                  style={done ? { borderColor: `${ACCENTS.green}40` } : undefined}
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
            </div>
          </section>
        )
      })}

      {champion && (
        <section className="flex min-w-[200px] flex-col gap-3">
          {/* The same row as the round headings, so it is the same height and
              the card below centres on the same line as the final. */}
          <div className="flex items-baseline justify-between px-0.5">
            <MonoLabel style={{ color: GOLD }}>Champion</MonoLabel>
          </div>
          <div className="flex flex-1 flex-col justify-around">
            <div
              className="flex flex-col items-center rounded-lg border px-4 py-5 text-center"
              style={{ borderColor: `${GOLD}55`, background: `radial-gradient(ellipse at 50% 0%, ${GOLD}26, transparent 70%), #0E0E12` }}
            >
              <Crown className="h-7 w-7" style={{ color: GOLD }} />
              <p className="mt-2 w-full truncate text-[16px] font-black text-white">{champion.username}</p>
              <p className="mt-0.5 w-full truncate text-[12px] text-white/45">{champion.game_name ?? "No slot"}</p>
            </div>
          </div>
        </section>
      )}
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
    <div
      className={`relative flex items-center gap-2.5 px-3 py-2.5 transition ${lost ? "opacity-40" : ""}`}
      style={won ? { backgroundColor: `${ACCENTS.green}12` } : undefined}
    >
      {won && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: ACCENTS.green }} />}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-black/40">
        {participant.game_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- slot art from any provider host
          <img src={participant.game_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-3.5 w-3.5 text-white/20" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {won && <Crown className="h-3 w-3 shrink-0 self-center" style={{ color: ACCENTS.green }} />}
          <span className="truncate text-[13px] font-semibold text-white">{participant.username}</span>
          {participant.is_super && <MonoLabel style={{ color: ACCENTS.amber }}>S</MonoLabel>}
          <span className="ml-auto shrink-0 text-[12.5px] font-semibold tabular-nums text-white/80">
            {payout === null ? <span className="text-white/20">—</span> : money(Number(payout))}
          </span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="truncate text-[11.5px] text-white/35">{participant.game_name ?? "No slot"}</span>
          {times !== null && (
            <span className="ml-auto shrink-0 text-[11.5px] font-bold tabular-nums" style={{ color: multiColor(times) }}>
              {times.toFixed(2)}x
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
