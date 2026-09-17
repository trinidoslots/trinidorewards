// Timezone handling for leaderboards.
//
// The bug this exists to kill: a <input type="datetime-local"> yields a naive
// string like "2026-10-01T00:00" with no zone. Stored straight into a
// timestamptz column, Postgres reads it as UTC, so a board meant to close at
// midnight Berlin time closed two hours early. Reading it back for editing had
// the same problem in reverse.
//
// Every leaderboard now carries its own IANA zone, and the admin's input is
// interpreted in that zone rather than in the browser's or the database's.

export const DEFAULT_TIMEZONE = "Europe/Berlin"

/** The zones worth offering; anything else can be typed into the field. */
export const COMMON_TIMEZONES = [
  "Europe/Berlin",
  "Europe/London",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const

/**
 * What a given instant reads as in `timeZone`, as the numeric parts.
 * Intl is the only dependency-free way to ask "what does this clock say there".
 */
function partsIn(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts: Record<string, number> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  // Intl renders midnight as hour 24 in some environments.
  if (parts.hour === 24) parts.hour = 0
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** How far `timeZone` is from UTC at `date`, in minutes. Handles DST. */
function offsetMinutes(date: Date, timeZone: string): number {
  const parts = partsIn(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return (asUtc - date.getTime()) / 60_000
}

/**
 * Turns a naive "YYYY-MM-DDTHH:mm" — what the admin typed — into the instant it
 * refers to in `timeZone`, ready to store.
 *
 * Applied twice because the offset itself depends on the instant: near a DST
 * boundary the first guess can be an hour out, and the second pass lands on the
 * right side of the change.
 */
export function zonedInputToUtc(local: string, timeZone: string): string | null {
  const match = local?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[]

  const naive = Date.UTC(year, month - 1, day, hour, minute)
  let instant = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000)
  instant = new Date(naive - offsetMinutes(instant, timeZone) * 60_000)
  return instant.toISOString()
}

/** The inverse: a stored instant as the "YYYY-MM-DDTHH:mm" the input expects. */
export function utcToZonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return ""
  const parts = partsIn(new Date(iso), timeZone)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

/**
 * Human-readable, always in the leaderboard's own zone — never the viewer's.
 * A board starting 1 Oct in Berlin used to render as "September" for anyone
 * west of UTC, because the month was taken from the visitor's clock.
 */
export function formatInZone(
  iso: string | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(new Date(iso))
}

/** Short zone label for the UI, e.g. "CEST". */
export function zoneAbbreviation(iso: string | null | undefined, timeZone: string): string {
  const date = iso ? new Date(iso) : new Date()
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date)
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone
}

export type LeaderboardStatus = "upcoming" | "active" | "ended"

/**
 * Status from the stored instants. Both sides are absolute moments, so this is
 * zone-independent — the zone only matters for input and display.
 */
export function leaderboardStatus(startIso: string, endIso: string, now: Date = new Date()): LeaderboardStatus {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (now.getTime() < start) return "upcoming"
  if (now.getTime() >= end) return "ended"
  return "active"
}
