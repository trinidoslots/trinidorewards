import { buildBracket, roundOnePairs, type Match, type Participant } from "@/lib/tournament"
import type { LiveTournament } from "@/hooks/use-tournament-live"

/**
 * A sample half-played 8-player battle, for ?preview=1 on the OBS sources.
 *
 * Positioning a browser source should not require a real tournament to be
 * running — this is the same shape the live hook returns, so the panels take
 * exactly the same code path they will on stream.
 */

const FIELD: [string, number, string, boolean][] = [
  ["trinidoslots", 200, "Le Bandit", false],
  ["Mcmonstermodd", 100, "Sugar Rush 1000", false],
  ["S2GBlackeagles", 400, "Wanted Dead or a Wild", true],
  ["Puffhuffle", 100, "San Quentin xWays", false],
  ["coyote18", 250, "Gates of Olympus", false],
  ["Lintai", 100, "Book of Shadows", false],
  ["zaini160610", 150, "Fire in the Hole 2", false],
  ["Bonna89", 300, "Mental", true],
]

const participants: Participant[] = FIELD.map(([username, buy, game, isSuper], index) => ({
  id: "preview-p" + (index + 1),
  username,
  buy_amount: buy,
  casino: "Stake",
  game_name: game,
  game_image_url: null,
  is_super: isSuper,
  seed: index + 1,
}))

const bySeed = new Map(participants.map((participant) => [participant.seed as number, participant]))
const firstRound = new Map(roundOnePairs(8, bySeed).map((pair) => [pair.match_number, pair]))

// Quarter-final payouts, in match order. The last match is left unplayed so the
// round panel has something to show.
const PLAYED: ([number, number] | null)[] = [
  [4_820, 1_150],
  [980, 6_400],
  [3_100, 2_750],
  null,
]

const matches: Match[] = buildBracket(8).map((slot) => {
  const base: Match = {
    id: `preview-r${slot.round_number}m${slot.match_number}`,
    round_number: slot.round_number,
    match_number: slot.match_number,
    p1_id: null,
    p2_id: null,
    p1_payout: null,
    p2_payout: null,
    winner_participant_id: null,
  }
  if (slot.round_number !== 1) return base

  const pair = firstRound.get(slot.match_number)
  base.p1_id = pair?.p1?.id ?? null
  base.p2_id = pair?.p2?.id ?? null

  const result = PLAYED[slot.match_number - 1]
  if (result) {
    base.p1_payout = result[0]
    base.p2_payout = result[1]
    base.winner_participant_id = result[0] > result[1] ? base.p1_id : base.p2_id
  }
  return base
})

// Feed the semi-finals from the quarter-finals that were played, the same way
// the console does when a result is saved.
for (const match of matches.filter((entry) => entry.round_number === 1 && entry.winner_participant_id)) {
  const target = matches.find(
    (entry) => entry.round_number === 2 && entry.match_number === Math.ceil(match.match_number / 2),
  )
  if (!target) continue
  if (match.match_number % 2 === 1) target.p1_id = match.winner_participant_id
  else target.p2_id = match.winner_participant_id
}

const tournament: LiveTournament = {
  id: "preview",
  title: "Bonus Battle — Preview",
  bracket_size: 8,
  bracket_status: "running",
  started_at: new Date(Date.now() - 42 * 60_000).toISOString(),
  finished_at: null,
  champion_participant_id: null,
  winner_username: null,
  created_at: new Date().toISOString(),
}

export const PREVIEW_TOURNAMENT = { tournament, participants, matches, loading: false }
