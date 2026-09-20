/**
 * Rebuilding a giveaway round from its stored row.
 *
 * The admin page kept the whole round in React state and only ever pushed it
 * outwards, so leaving the page and coming back started from nothing. Reading
 * it back is the fix; doing the mapping here rather than inline in the effect
 * is what makes it checkable without a database.
 *
 * No imports on purpose — see lib/points-activity for the same reasoning.
 */

export type GiveawayStatus = "idle" | "open" | "closed" | "rolling" | "finished"

export type StoredRound = {
  status?: unknown
  keyword?: unknown
  entrants?: unknown
  entrant_avatars?: unknown
  winner?: unknown
  roll_duration_seconds?: unknown
  started_at?: unknown
}

export type RestoredRound = {
  entrants: string[]
  avatars: Record<string, string | null>
  /** Entries are only accepted again if the round was actually left open. */
  isOpen: boolean
  keyword: string | null
  rollDuration: number | null
  startedAt: number | null
  winner: string | null
  revealPhase: "idle" | "revealed"
  /**
   * Winners excluded from a redraw.
   *
   * Only ever the latest one: the full set for the round was never persisted,
   * so somebody who won earlier in the same round can be drawn again after the
   * page has been left and reopened.
   */
  roundWinners: string[]
}

const STATUSES: GiveawayStatus[] = ["idle", "open", "closed", "rolling", "finished"]

function readStatus(value: unknown): GiveawayStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value)
    ? (value as GiveawayStatus)
    : "idle"
}

function readNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) seen.add(entry)
  }
  return [...seen]
}

function readAvatars(value: unknown): Record<string, string | null> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const avatars: Record<string, string | null> = {}
  for (const [name, url] of Object.entries(value as Record<string, unknown>)) {
    avatars[name] = typeof url === "string" ? url : null
  }
  return avatars
}

export function restoreRound(row: StoredRound | null | undefined): RestoredRound {
  const empty: RestoredRound = {
    entrants: [],
    avatars: {},
    isOpen: false,
    keyword: null,
    rollDuration: null,
    startedAt: null,
    winner: null,
    revealPhase: "idle",
    roundWinners: [],
  }

  if (!row) return empty

  const status = readStatus(row.status)
  const winner = typeof row.winner === "string" && row.winner ? row.winner : null

  // Only a finished round shows its winner again. Coming back mid-roll cannot
  // pick the animation back up at the right frame, so it settles as a closed
  // round with the entrants intact rather than replaying it.
  const finished = status === "finished" && winner !== null

  const startedAt = typeof row.started_at === "string" ? Date.parse(row.started_at) : NaN
  const duration = Number(row.roll_duration_seconds)

  return {
    entrants: readNames(row.entrants),
    avatars: readAvatars(row.entrant_avatars),
    isOpen: status === "open",
    keyword: typeof row.keyword === "string" && row.keyword ? row.keyword : null,
    rollDuration: Number.isFinite(duration) && duration > 0 ? duration : null,
    // An unparseable timestamp must not become NaN, which would render as a
    // broken runtime badge counting from nowhere.
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    winner: finished ? winner : null,
    revealPhase: finished ? "revealed" : "idle",
    roundWinners: finished ? [winner] : [],
  }
}
