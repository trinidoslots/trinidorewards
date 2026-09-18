/** Adjusting a points balance. */

export type PointsAction = "add" | "remove" | "set"

/**
 * The balance after an adjustment.
 *
 * Removing more than someone holds floors at zero rather than going negative —
 * a negative balance would be shown, spent against and subtracted from, and
 * none of the rest of the site expects one.
 */
export function nextBalance(current: number, action: PointsAction, amount: number): number {
  const balance = Number(current) || 0
  const change = Number(amount) || 0
  if (action === "add") return balance + change
  if (action === "remove") return Math.max(0, balance - change)
  return Math.max(0, change)
}
