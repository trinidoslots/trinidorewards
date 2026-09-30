/**
 * Slot challenges: the rules shared by the public page, the claim route and
 * the admin panel. Tables in scripts/083_challenges.sql.
 *
 * Kept free of React and Supabase so it can be tested on its own.
 */

export type Challenge = {
  id: string
  slot_name: string
  provider: string | null
  image_url: string | null
  target_type: "multiplier" | "payout"
  target_value: number
  min_bet: number
  prize_amount: number
  prize_type: "cash" | "points"
  max_winners: number | null
  starts_at: string
  ends_at: string | null
  ended_at: string | null
  notes: string | null
  created_at: string
}

export type SubmissionStatus = "pending" | "approved" | "rejected"

export type Submission = {
  id: string
  challenge_id: string
  user_id: string | null
  username: string
  bet_id: string
  status: SubmissionStatus
  note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export type Phase = "active" | "upcoming" | "completed"

/**
 * Where a challenge stands.
 *
 * Completed wins over everything: ended by hand, past its end time, or every
 * winner slot filled by an approved claim. Otherwise it is upcoming until its
 * start time, and active after.
 */
export function phaseOf(challenge: Pick<Challenge, "starts_at" | "ends_at" | "ended_at" | "max_winners">, approved: number, now = Date.now()): Phase {
  if (challenge.ended_at) return "completed"
  if (challenge.ends_at && Date.parse(challenge.ends_at) <= now) return "completed"
  if (challenge.max_winners !== null && approved >= challenge.max_winners) return "completed"
  if (Date.parse(challenge.starts_at) > now) return "upcoming"
  return "active"
}

/**
 * The bet id in what a viewer typed, or null.
 *
 * Exactly "casino:" followed by digits, as Stake shows it on a bet. Anything
 * else is refused: a URL, the digits alone, "house:…", spaces inside.
 * Surrounding whitespace is forgiven, since a paste often carries some.
 */
export function readCasinoId(input: unknown): string | null {
  if (typeof input !== "string") return null
  const match = /^casino:(\d{1,30})$/.exec(input.trim())
  return match ? match[1] : null
}

/** The bet on Stake, opened in its bet modal. */
export function stakeBetUrl(betId: string): string {
  return `https://stake.com/?iid=house%3A${encodeURIComponent(betId)}&modal=bet`
}

/** Whole dollars without cents ($50), anything else with both digits ($0.20). */
const usd = (value: number) => {
  const number = Number(value)
  const cents = Number.isInteger(number) ? 0 : 2
  return "$" + number.toLocaleString("en-US", { minimumFractionDigits: cents, maximumFractionDigits: cents })
}

/** "1,000x" or "$500" — what has to be hit. */
export function targetLabel(challenge: Pick<Challenge, "target_type" | "target_value">): string {
  return challenge.target_type === "payout"
    ? usd(challenge.target_value)
    : `${Number(challenge.target_value).toLocaleString("en-US", { maximumFractionDigits: 2 })}x`
}

export function prizeLabel(challenge: Pick<Challenge, "prize_amount" | "prize_type">): string {
  return challenge.prize_type === "points"
    ? `${Math.round(challenge.prize_amount).toLocaleString("en-US")} points`
    : usd(challenge.prize_amount)
}

export function minBetLabel(value: number): string {
  return value > 0 ? usd(value) : "Any"
}
