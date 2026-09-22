/**
 * The "starting soon" screen's state and its clock.
 *
 * The formatting lives here rather than in the component so it can be tested
 * without a browser — a countdown is exactly the kind of thing that looks right
 * for the twenty seconds you watch it and then does something silly at a
 * boundary you did not sit through.
 */

export type StartingSoonRow = {
  id: number
  /** ISO timestamp, or null for "soon" with no clock. */
  starts_at: string | null
  headline: string
  subline: string | null
  ended_text: string
  updated_at: string
}

export const STARTING_SOON_DEFAULTS = {
  headline: "Starting soon",
  subline: null,
  ended_text: "Any moment now",
} as const

/** Longest a countdown may be set for. Anything above this is a typo. */
export const MAX_COUNTDOWN_DAYS = 14

export type Countdown =
  /** No target set — headline only. */
  | { kind: "none" }
  /** Counting down. */
  | { kind: "running"; hours: number; minutes: number; seconds: number; totalMs: number }
  /** The target has passed. */
  | { kind: "elapsed" }

/**
 * Time left, as whole units.
 *
 * Rounds up rather than down: with 4.2 seconds to go a countdown that floors
 * shows 00:04, sits there for a fifth of a second and then jumps to 00:03, so
 * the first number is short and the last one is long. Ceiling makes every digit
 * last a full second, and it means the clock reads 00:01 until zero actually
 * arrives instead of showing 00:00 for a second while nothing happens.
 */
export function countdownFrom(startsAt: string | null | undefined, now: number): Countdown {
  if (!startsAt) return { kind: "none" }

  const target = Date.parse(startsAt)
  // An unparseable timestamp is treated as no timestamp. The alternative is
  // NaN propagating into the clock and rendering "NaN:NaN" on stream.
  if (!Number.isFinite(target)) return { kind: "none" }

  const remaining = target - now
  if (remaining <= 0) return { kind: "elapsed" }

  const totalSeconds = Math.ceil(remaining / 1000)
  return {
    kind: "running",
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs: remaining,
  }
}

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * The clock face.
 *
 * Hours only appear once there are any, so a five-minute wait reads 04:59 and
 * not 00:04:59 — but the field does not then jump width when it crosses an
 * hour, because a countdown that long is set deliberately and stays long.
 */
export function formatCountdown(countdown: Countdown): string | null {
  if (countdown.kind !== "running") return null
  const { hours, minutes, seconds } = countdown
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/**
 * Turns a datetime-local value into an ISO string.
 *
 * `<input type="datetime-local">` hands back "2026-09-22T20:30" with no zone,
 * meaning the admin's own wall clock. new Date() reads it as local time, which
 * is what we want — the resulting ISO string is that instant in UTC, so an
 * overlay in any timezone counts down to the same moment.
 */
export function localInputToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toISOString()
}

/** The inverse, for filling the form from the stored row. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const parsed = new Date(iso)
  if (!Number.isFinite(parsed.getTime())) return ""
  // Shift by the offset so toISOString's UTC slice reads as local wall time,
  // which is the only format the input accepts.
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** "in 12 minutes" / "8 minutes ago", for the admin panel's confirmation line. */
export function describeTarget(iso: string | null, now: number): string {
  if (!iso) return "No time set — the screen shows the headline only."
  const target = Date.parse(iso)
  if (!Number.isFinite(target)) return "That timestamp could not be read."

  const deltaMinutes = Math.round((target - now) / 60_000)
  const when = new Date(target).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  if (deltaMinutes > 0) return `${when} — in ${deltaMinutes} minute${deltaMinutes === 1 ? "" : "s"}.`
  if (deltaMinutes < 0) {
    const ago = Math.abs(deltaMinutes)
    return `${when} — ${ago} minute${ago === 1 ? "" : "s"} ago, so the screen shows the ended text.`
  }
  return `${when} — now.`
}
