/**
 * Week maths for the schedule.
 *
 * All of it works in local time on purpose: the grid is "your week", and a
 * stream at 01:00 on Monday belongs to Monday where the viewer is, not to
 * Sunday in UTC. Doing this with toISOString would put it in the wrong column
 * for everyone east of Greenwich.
 */

export const DAY_MS = 24 * 60 * 60 * 1000

/** The Sunday that starts the week containing `date`, at local midnight. */
export function startOfWeek(date: Date, weekStartsOn = 0): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const shift = (start.getDay() - weekStartsOn + 7) % 7
  start.setDate(start.getDate() - shift)
  return start
}

/**
 * The seven days of that week.
 *
 * Built by setDate rather than by adding 24 hours, so the week does not slide
 * by an hour across a daylight-saving change — in a spring-forward week, the
 * seventh day would otherwise land at 01:00 and could roll into the next date.
 */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + index)
    return day
  })
}

/** Local calendar key, e.g. "2026-09-18". Used to bucket entries by column. */
export function dayKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addWeeks(weekStart: Date, count: number): Date {
  const next = new Date(weekStart)
  next.setDate(weekStart.getDate() + count * 7)
  return next
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}

/** "Sep 13 – Sep 19", the range shown beside the heading. */
export function weekLabel(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(weekStart.getDate() + 6)
  const format = (date: Date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `${format(weekStart)} – ${format(end)}`
}

/** "GMT+2" for the viewer's own zone, for the label beside the selector. */
export function localOffsetLabel(at = new Date()): string {
  const minutes = -at.getTimezoneOffset()
  if (minutes === 0) return "GMT"
  const sign = minutes > 0 ? "+" : "-"
  const hours = Math.floor(Math.abs(minutes) / 60)
  const rest = Math.abs(minutes) % 60
  return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; over: boolean }

export function countdownTo(iso: string | null | undefined, now = Date.now()): Countdown {
  const target = iso ? Date.parse(iso) : Number.NaN
  const diff = Number.isFinite(target) ? target - now : -1

  if (!Number.isFinite(diff) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, over: true }
  }
  return {
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    over: false,
  }
}

/** The accents a segment can be given, matching the board palette. */
export const SEGMENT_COLORS = ["blue", "green", "amber", "purple", "pink", "red", "slate"] as const
export type SegmentColor = (typeof SEGMENT_COLORS)[number]
