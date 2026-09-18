/** The stream schedule, shared by the admin form and the public page. */

export type ScheduleEntry = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  category: string | null
  url: string | null
  is_cancelled: boolean
  /** One of the board accents, for the dot beside the segment. */
  color?: string | null
  /** A day marked off, rather than a day with nothing announced. */
  is_day_off?: boolean
  /** Position within its day. */
  sort_order?: number
}

/** Suggestions in the admin form. Free text is still accepted. */
export const SCHEDULE_CATEGORIES = ["Bonus Hunt", "Tournament", "Slots", "Giveaway", "Special"]

export type ScheduleState = "live" | "upcoming" | "past"

/**
 * Where an entry sits relative to now.
 *
 * An entry with no end time counts as live for three hours after it starts —
 * long enough to cover a normal stream, short enough that a forgotten entry
 * does not sit on the page claiming to be live the next morning.
 */
export const ASSUMED_LENGTH_MS = 3 * 60 * 60 * 1000

export function stateOf(entry: ScheduleEntry, now = Date.now()): ScheduleState {
  const start = Date.parse(entry.starts_at)
  if (!Number.isFinite(start)) return "past"

  const end = entry.ends_at ? Date.parse(entry.ends_at) : start + ASSUMED_LENGTH_MS
  if (now < start) return "upcoming"
  if (now <= (Number.isFinite(end) ? end : start + ASSUMED_LENGTH_MS)) return "live"
  return "past"
}

/** Entries grouped by calendar day, in the viewer's own timezone. */
export function groupByDay(entries: ScheduleEntry[]): { day: string; label: string; entries: ScheduleEntry[] }[] {
  const days = new Map<string, ScheduleEntry[]>()

  for (const entry of [...entries].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
    const date = new Date(entry.starts_at)
    if (Number.isNaN(date.getTime())) continue
    // Local date parts, not toISOString — that would bucket a 01:00 stream
    // into the previous day for anyone east of UTC.
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    days.set(key, [...(days.get(key) ?? []), entry])
  }

  return Array.from(days.entries()).map(([day, list]) => ({
    day,
    label: new Date(list[0].starts_at).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    entries: list,
  }))
}

export function timeRange(entry: ScheduleEntry): string {
  const start = new Date(entry.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  if (!entry.ends_at) return start
  const end = new Date(entry.ends_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return `${start} — ${end}`
}
