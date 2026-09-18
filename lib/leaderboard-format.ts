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

/**
 * The same amount, split so the cents can be set quieter than the dollars.
 *
 * On a board of ten-thousand-dollar wagers the cents are noise you still have
 * to print — dropping them makes the number look rounded, and giving them the
 * same weight as the dollars makes every row harder to scan. Muting them is
 * the way out.
 */
export function moneyParts(value: number | string): { whole: string; cents: string } {
  const amount = Number(value) || 0
  const text = moneyExact(amount)
  const dot = text.lastIndexOf(".")
  return dot === -1 ? { whole: text, cents: "" } : { whole: text.slice(0, dot), cents: text.slice(dot) }
}

/** Ordinal place: 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinal(n: number): string {
  const value = Math.trunc(Number(n) || 0)
  const lastTwo = Math.abs(value) % 100
  // 11th, 12th and 13th break the rule that the last digit decides.
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`
  switch (Math.abs(value) % 10) {
    case 1:
      return `${value}st`
    case 2:
      return `${value}nd`
    case 3:
      return `${value}rd`
    default:
      return `${value}th`
  }
}
