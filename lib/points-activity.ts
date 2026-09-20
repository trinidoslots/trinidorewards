/**
 * Who counts as "active in chat", and what a grant would do.
 *
 * Deliberately free of imports: the rules here decide who gets points, so they
 * are the part that has to be checkable without a browser, a database or a
 * running stream. Everything that talks to Supabase builds on these.
 */

/** Widest window the panel or the API will accept, in minutes. */
export const MAX_WINDOW_MINUTES = 1440
export const MIN_WINDOW_MINUTES = 1

/** A single grant is capped well below the point where a typo empties the economy. */
export const MAX_POINTS_EACH = 1_000_000

export const DEFAULT_WINDOW_MINUTES = 10
export const DEFAULT_POINTS_EACH = 100

/**
 * How stale the newest recorded message may be before the panel calls the
 * recorder dead. Two flush intervals plus slack — see RECORDER_FLUSH_MS.
 */
export const RECORDER_STALE_MS = 90_000

/** How often a recording page sends what it has seen. */
export const RECORDER_FLUSH_MS = 10_000

/**
 * Cap on how far back a recorder may date a message it is reporting.
 *
 * The recorder batches, so it sends "this was N ms ago" rather than a clock
 * reading — the browser's clock is not trusted, only its stopwatch. Anything
 * beyond a couple of minutes is a bug or an attempt to backdate, and is clamped.
 */
export const MAX_REPORTED_AGE_MS = 120_000

export type Chatter = {
  kickId: string
  username: string
  /** Milliseconds between the message and the flush that reported it. */
  agoMs: number
  messages: number
}

export type ActivityRow = {
  kick_id: string
  username: string
  last_message_at: string
  message_count: number
}

export type AccountRow = {
  id: string
  kick_id: string | null
  username: string
  points_balance: number | null
}

export function clampWindowMinutes(value: unknown): number {
  const minutes = Math.floor(Number(value))
  if (!Number.isFinite(minutes)) return DEFAULT_WINDOW_MINUTES
  return Math.min(MAX_WINDOW_MINUTES, Math.max(MIN_WINDOW_MINUTES, minutes))
}

export function clampPointsEach(value: unknown): number {
  const points = Math.floor(Number(value))
  if (!Number.isFinite(points)) return DEFAULT_POINTS_EACH
  return Math.min(MAX_POINTS_EACH, Math.max(1, points))
}

export function clampReportedAge(value: unknown): number {
  const ms = Math.floor(Number(value))
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.min(MAX_REPORTED_AGE_MS, ms)
}

/**
 * Kick ids arrive from a WebSocket payload, so they are checked rather than
 * trusted: numeric, and short enough that nobody is stuffing the key column.
 */
export function isValidKickId(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,20}$/.test(value)
}

/** Normalises one entry of a recorder batch, or rejects it. */
export function readChatter(raw: unknown): Chatter | null {
  if (typeof raw !== "object" || raw === null) return null
  const entry = raw as Record<string, unknown>

  const kickId = typeof entry.kickId === "number" ? String(entry.kickId) : entry.kickId
  if (!isValidKickId(kickId)) return null

  const username = typeof entry.username === "string" ? entry.username.trim().slice(0, 64) : ""
  if (!username) return null

  const messages = Math.floor(Number(entry.messages))

  return {
    kickId,
    username,
    agoMs: clampReportedAge(entry.agoMs),
    // A batch always represents at least the one message that created it.
    messages: Number.isFinite(messages) && messages > 0 ? Math.min(messages, 10_000) : 1,
  }
}

/**
 * A batch can mention the same person several times (they said several things
 * between two flushes). Collapse to one row each, keeping the most recent
 * moment and the total count, so the upsert touches every key exactly once —
 * Postgres rejects an ON CONFLICT batch that hits the same key twice.
 */
export function collapseChatters(entries: Chatter[]): Chatter[] {
  const byId = new Map<string, Chatter>()

  for (const entry of entries) {
    const existing = byId.get(entry.kickId)
    if (!existing) {
      byId.set(entry.kickId, { ...entry })
      continue
    }
    existing.messages += entry.messages
    // Smaller agoMs means more recent.
    if (entry.agoMs < existing.agoMs) {
      existing.agoMs = entry.agoMs
      existing.username = entry.username
    }
  }

  return [...byId.values()]
}

export function isActive(lastMessageAt: string, now: number, windowMinutes: number): boolean {
  const at = Date.parse(lastMessageAt)
  // An unparseable timestamp must not count as "just now" — that would hand
  // points to whoever has the broken row.
  if (!Number.isFinite(at)) return false
  return now - at <= windowMinutes * 60_000
}

export type ActiveSplit = {
  /** In the window and holding a site account — these are the ones paid. */
  withAccount: { userId: string; kickId: string; username: string; balance: number }[]
  /** In the window, no account. Shown so it is visible who is missing out. */
  withoutAccount: { kickId: string; username: string }[]
}

/**
 * Splits the active chatters by whether they have an account.
 *
 * Matched on kick_id and nothing else. The previous attempt matched on the
 * username, which quietly paid nobody as soon as somebody changed their Kick
 * name or typed it with different capitalisation.
 */
export function splitByAccount(active: ActivityRow[], accounts: AccountRow[]): ActiveSplit {
  const byKickId = new Map<string, AccountRow>()
  for (const account of accounts) {
    if (account.kick_id) byKickId.set(account.kick_id, account)
  }

  const split: ActiveSplit = { withAccount: [], withoutAccount: [] }

  for (const row of active) {
    const account = byKickId.get(row.kick_id)
    if (account) {
      split.withAccount.push({
        userId: account.id,
        kickId: row.kick_id,
        // The account's own name wins: it is what the admin panel and the
        // profile show, and chat_activity only ever holds the last spelling.
        username: account.username || row.username,
        balance: Number(account.points_balance) || 0,
      })
    } else {
      split.withoutAccount.push({ kickId: row.kick_id, username: row.username })
    }
  }

  return split
}

/** Whether the panel should trust that something is currently recording. */
export function recorderState(lastMessageAt: string | null, now: number): "live" | "stale" | "never" {
  if (!lastMessageAt) return "never"
  const at = Date.parse(lastMessageAt)
  if (!Number.isFinite(at)) return "never"
  return now - at <= RECORDER_STALE_MS ? "live" : "stale"
}

/** "500 points to 47 users" — the button says what it will do before it is pressed. */
export function grantLabel(userCount: number, pointsEach: number): string {
  const points = pointsEach.toLocaleString("en-US")
  const users = userCount.toLocaleString("en-US")
  return `${points} ${pointsEach === 1 ? "point" : "points"} to ${users} ${userCount === 1 ? "user" : "users"}`
}
