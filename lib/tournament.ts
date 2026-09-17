// Bracket maths for the bonus-battle tournaments.
//
// Kept free of Supabase and React on purpose: seeding and advancement are the
// part that is easy to get subtly wrong (a winner landing in the wrong slot of
// the next round is invisible until the final), so they are plain functions
// that can be checked directly.

export const BRACKET_SIZES = [4, 8, 16, 32] as const
export type BracketSize = (typeof BRACKET_SIZES)[number]

export type Participant = {
  id: string
  username: string
  buy_amount: number
  casino: string | null
  game_name: string | null
  game_image_url: string | null
  is_super: boolean
  seed: number | null
}

export type Match = {
  id: string
  round_number: number
  match_number: number
  p1_id: string | null
  p2_id: string | null
  p1_payout: number | null
  p2_payout: number | null
  winner_participant_id: string | null
  /** When the result was entered. Drives how recent the tournament looks. */
  played_at?: string | null
}

/** How many rounds a bracket of this size runs. 8 players -> 3 rounds. */
export function roundCount(size: number): number {
  return Math.log2(size)
}

/**
 * Round names counted back from the final, which is how they are spoken about:
 * the last round is the final, the one before it the semi-finals.
 */
export function roundLabel(round: number, size: number): string {
  const fromEnd = roundCount(size) - round
  if (fromEnd === 0) return "Finals"
  if (fromEnd === 1) return "Semi-finals"
  if (fromEnd === 2) return "Quarter-finals"
  return `Round of ${2 ** (fromEnd + 1)}`
}

/** Matches in a given round. Round 1 of an 8-bracket has 4. */
export function matchesInRound(round: number, size: number): number {
  return size / 2 ** round
}

/**
 * Standard bracket seed order.
 *
 * Built by repeated doubling: each seed s in a bracket of n is replaced by the
 * pair (s, n+1-s). That is what puts the top two seeds in opposite halves.
 *
 * Listing the pairs as 1v8, 2v7, 3v6, 4v5 in match order looks right and is
 * wrong — matches 1 and 2 feed the same semi-final, so seeds 1 and 2 would meet
 * one round early, and for a 16 or 32 bracket earlier still.
 */
function seedOrder(size: number): number[] {
  let order = [1]
  for (let n = 2; n <= size; n *= 2) {
    const next: number[] = []
    for (const seed of order) next.push(seed, n + 1 - seed)
    order = next
  }
  return order
}

/** The seed pairs for round 1, in match order. */
export function seedPairs(size: number): [number, number][] {
  const order = seedOrder(size)
  const pairs: [number, number][] = []
  for (let i = 0; i < order.length; i += 2) {
    pairs.push([order[i], order[i + 1]])
  }
  return pairs
}

/**
 * Where the winner of a match goes. Matches are numbered from 1 within each
 * round, so match 1 and 2 of a round feed match 1 of the next, 3 and 4 feed 2.
 *
 * `slot` says whether they arrive as the first or second name in that match,
 * which is what keeps the bracket drawing in the right order.
 */
export function advanceTo(round: number, matchNumber: number): { round: number; matchNumber: number; slot: 1 | 2 } {
  return {
    round: round + 1,
    matchNumber: Math.ceil(matchNumber / 2),
    slot: matchNumber % 2 === 1 ? 1 : 2,
  }
}

/** The empty match grid for a bracket, ready to be persisted. */
export function buildBracket(size: number): { round_number: number; match_number: number }[] {
  const matches: { round_number: number; match_number: number }[] = []
  for (let round = 1; round <= roundCount(size); round++) {
    for (let matchNumber = 1; matchNumber <= matchesInRound(round, size); matchNumber++) {
      matches.push({ round_number: round, match_number: matchNumber })
    }
  }
  return matches
}

/**
 * Who won. The higher payout takes it; an exact tie is refused rather than
 * broken arbitrarily, because on stream that is a decision for the host.
 */
export function decideMatch(
  p1Payout: number,
  p2Payout: number,
): { winner: 1 | 2 } | { winner: null; reason: string } {
  if (!Number.isFinite(p1Payout) || !Number.isFinite(p2Payout)) {
    return { winner: null, reason: "Both payouts have to be filled in." }
  }
  if (p1Payout === p2Payout) {
    return { winner: null, reason: "Both payouts are equal — decide the tie and enter different numbers." }
  }
  return { winner: p1Payout > p2Payout ? 1 : 2 }
}

/** A match can be played once both sides are known. */
export function isPlayable(match: Match): boolean {
  return !!match.p1_id && !!match.p2_id && !match.winner_participant_id
}

/** Multiple of the buy amount a payout represents — the number worth showing. */
export function multiplier(payout: number | null, buyAmount: number): number | null {
  if (payout === null || !buyAmount) return null
  return payout / buyAmount
}

export type TournamentTotals = {
  participants: number
  totalBuyIn: number
  totalPaidOut: number
  /** Paid out minus bought in, across every match played so far. */
  net: number
  matchesPlayed: number
  matchesTotal: number
}

export function tournamentTotals(participants: Participant[], matches: Match[], size: number): TournamentTotals {
  const totalBuyIn = participants.reduce((sum, participant) => sum + (Number(participant.buy_amount) || 0), 0)
  const totalPaidOut = matches.reduce(
    (sum, match) => sum + (Number(match.p1_payout) || 0) + (Number(match.p2_payout) || 0),
    0,
  )
  return {
    participants: participants.length,
    totalBuyIn,
    totalPaidOut,
    net: totalPaidOut - totalBuyIn,
    matchesPlayed: matches.filter((match) => match.winner_participant_id).length,
    matchesTotal: size - 1,
  }
}

/**
 * Casinos offered in the add-participant form. A plain list rather than a table
 * because it changes about twice a year and a dropdown of five hard-coded names
 * is not worth a migration; anything already used on a past participant is
 * merged in at render time, so a one-off casino is never lost.
 */
export const TOURNAMENT_CASINOS = [
  "Stake",
  "Roobet",
  "Rollbit",
  "Gamdom",
  "Shuffle",
  "BC.Game",
  "Duelbits",
  "Goated",
] as const

/**
 * Money as it is spoken on stream: no cents unless there are cents.
 *
 * Pinned to en-US rather than the viewer's locale for two reasons: a dollar
 * sign next to German grouping reads as "$3.100" for three thousand, and the
 * server and the browser would otherwise format the same number differently
 * and trip a hydration mismatch.
 */
export function money(value: number | null | undefined): string {
  const amount = Number(value) || 0
  const hasCents = Math.abs(amount % 1) > 0.004
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Round one, as participant pairs.
 *
 * `bySeed` is looked up rather than indexed into so that a missing seed yields
 * null (an empty slot) instead of throwing — the bracket still draws, with the
 * hole visible, which is far easier to diagnose than a blank page.
 */
export function roundOnePairs(
  size: number,
  bySeed: Map<number, Participant>,
): { match_number: number; p1: Participant | null; p2: Participant | null }[] {
  return seedPairs(size).map(([a, b], index) => ({
    match_number: index + 1,
    p1: bySeed.get(a) ?? null,
    p2: bySeed.get(b) ?? null,
  }))
}

export type Standing = {
  participant: Participant
  /** Best payout this player recorded in any match they have opened. */
  bestPayout: number | null
  /** That payout as a multiple of their buy amount. */
  bestMultiplier: number | null
  matchesWon: number
  /** True once they have lost a match — they are out of the bracket. */
  eliminated: boolean
}

/**
 * The table behind the overlay: who is still in, and what their best result was.
 *
 * Ordered by multiplier rather than raw payout, because buy amounts differ
 * between players and the raw number would just rank whoever bought biggest.
 * Players with no result yet sort last, ahead of nobody, rather than being
 * treated as a zero.
 */
export function standings(participants: Participant[], matches: Match[]): Standing[] {
  const rows = participants.map((participant) => {
    let bestPayout: number | null = null
    let matchesWon = 0
    let eliminated = false

    for (const match of matches) {
      const side = match.p1_id === participant.id ? 1 : match.p2_id === participant.id ? 2 : 0
      if (!side) continue

      const payout = side === 1 ? match.p1_payout : match.p2_payout
      if (payout !== null && payout !== undefined) {
        const value = Number(payout)
        if (Number.isFinite(value) && (bestPayout === null || value > bestPayout)) bestPayout = value
      }

      if (match.winner_participant_id) {
        if (match.winner_participant_id === participant.id) matchesWon++
        else eliminated = true
      }
    }

    return {
      participant,
      bestPayout,
      bestMultiplier: multiplier(bestPayout, Number(participant.buy_amount)),
      matchesWon,
      eliminated,
    }
  })

  return rows.sort((a, b) => {
    if (a.bestMultiplier === null && b.bestMultiplier === null) {
      return (a.participant.seed ?? 0) - (b.participant.seed ?? 0)
    }
    if (a.bestMultiplier === null) return 1
    if (b.bestMultiplier === null) return -1
    return b.bestMultiplier - a.bestMultiplier
  })
}
