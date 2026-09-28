import { DEFAULT_TIMEZONE, zonedInputToUtc } from "@/lib/leaderboard-time"

/**
 * Accepts "31.10.2026", "31.10.2026 20:00", an ISO string, unix seconds or a Date.
 *
 * A typed "31.10.2026 20:00" means Berlin time. The server runs in UTC, so it
 * goes through the same zone conversion the leaderboard admin uses rather than
 * `new Date(y, m, d)`, which would read it as UTC and post it an hour or two off.
 */
export function parseDate(input: unknown): Date | null {
  if (input === undefined || input === null || input === "") return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  if (typeof input === "number") return new Date(input < 1e12 ? input * 1000 : input)

  const match = String(input)
    .trim()
    .match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?$/)
  if (match) {
    const [, d, mo, y, h = "0", mi = "0"] = match
    const pad = (value: string) => value.padStart(2, "0")
    const iso = zonedInputToUtc(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`, DEFAULT_TIMEZONE)
    return iso ? new Date(iso) : null
  }
  const date = new Date(String(input))
  return Number.isNaN(date.getTime()) ? null : date
}

/** A Discord timestamp, which every reader sees in their own time zone. */
export function discordTime(input: unknown, style: "f" | "F" | "R" | "d" | "t" = "f"): string | null {
  const date = parseDate(input)
  return date ? `<t:${Math.floor(date.getTime() / 1000)}:${style}>` : null
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} Std. ${m} Min.` : `${m} Min.`
}
