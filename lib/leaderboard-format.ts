/**
 * Money on the leaderboard, in two shapes.
 *
 * Wagers arrive from a CSV with cents and people check them against their own
 * records, so those are shown to the cent. Prizes come out of prizeFor(), which
 * rounds to whole dollars, and printing ".00" after every one of them is just
 * noise — so a whole number prints whole.
 *
 * Pinned to en-US on purpose: a German locale renders 12.500,00 next to a "$",
 * which reads as twelve and a half dollars, and it differs between the server
 * and the browser, which is a hydration mismatch.
 *
 * Earnings can be negative — a player down on the month — so the sign goes in
 * front of the symbol. "$-320.50" is where you get if you just concatenate.
 */

function withSign(amount: number, body: string): string {
  return amount < 0 ? "-$" + body : "$" + body
}

export function moneyExact(value: number | string): string {
  const amount = Number(value) || 0
  return withSign(
    amount,
    Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )
}

export function money(value: number | string): string {
  const amount = Number(value) || 0
  const whole = Number.isInteger(amount)
  return withSign(
    amount,
    Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }),
  )
}

/** "12d 7h 16m 1s", dropping the leading units that are still zero. */
export function countdownLabel(left: {
  days: number
  hours: number
  minutes: number
  seconds: number
  over: boolean
}): string {
  if (left.over) return "Closed"
  const parts: string[] = []
  if (left.days > 0) parts.push(`${left.days}d`)
  if (left.days > 0 || left.hours > 0) parts.push(`${left.hours}h`)
  if (left.days > 0 || left.hours > 0 || left.minutes > 0) parts.push(`${left.minutes}m`)
  parts.push(`${left.seconds}s`)
  return parts.join(" ")
}
