import type { Transaction, TransactionTotals } from "@/lib/transactions"

/**
 * The shape /api/admin/dashboard answers with.
 *
 * Here rather than in the route file so the page can import it without
 * naming a module that also pulls in the service-role client. `import type`
 * is erased and would have been harmless, but a type import from a route
 * handler invites the next person to drop the `type` and ship the key.
 */
export type DashboardPayload = {
  users: { total: number; recent: number }
  /** The canonical figure from settings, or null if it has never been set. */
  givenAway: number | null
  redemptions: { total: number; pending: number }
  wins: { total: number; pending: number }
  /** Counts that each mean somebody has to go and do something. */
  queue: { redemptions: number; wins: number; raffles: number; leaderboards: number }
  leaderboards: LeaderboardSummary[]
  modules: { total: number; disabled: number }
  ledger: { totals: TransactionTotals; recent: Transaction[] }
  /** Null when no hunt is active. */
  hunt: HuntSummary | null
}

export type LeaderboardSummary = {
  id: string
  title: string
  subtitle: string | null
  prize_pool: number
  start_date: string
  end_date: string
}

export type HuntSummary = {
  title: string | null
  opened: number
  total: number
  isOpening: boolean
}

/**
 * "4d 19h", the way the site's own leaderboard cards put it.
 *
 * Under a day it drops to hours and minutes, because "0d 3h" is a worse way
 * of saying "3h 12m" on the day a board closes.
 */
export function timeLeft(ms: number): string {
  if (ms <= 0) return "Ended"

  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

/**
 * How far through its own period a leaderboard is, as a percentage.
 *
 * Derived, not stored: a row carrying a "days left" column is wrong the
 * moment nobody writes to it. Clamped, because a board left active past its
 * end date would otherwise draw a bar longer than the track.
 */
export function periodProgress(startISO: string, endISO: string, now = Date.now()): number {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()
  const span = end - start
  if (!Number.isFinite(span) || span <= 0) return 0
  return Math.min(100, Math.max(0, ((now - start) / span) * 100))
}
