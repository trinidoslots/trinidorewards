/**
 * The schedule's info text: a title and a few lines, written in Admin >
 * Schedule and shown above the week, where visitors can fold it away.
 *
 * Stored in `settings` (key schedule_info) as JSON text. An empty text means
 * there is nothing to show.
 */

export const SCHEDULE_INFO_KEY = "schedule_info"

export type ScheduleInfo = { title: string; text: string }

/** What is stored, as typed: no default title. Tolerates a plain string and a jsonb object. */
export function rawScheduleInfo(value: unknown): ScheduleInfo {
  let parsed: unknown = value
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = { title: "", text: value }
    }
  }
  const record = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>
  return {
    title: typeof record.title === "string" ? record.title.trim() : "",
    text: typeof record.text === "string" ? record.text.trim() : "",
  }
}

/** As the schedule shows it: null when there is no text, a default title when none was given. */
export function readScheduleInfo(value: unknown): ScheduleInfo | null {
  const { title, text } = rawScheduleInfo(value)
  return text ? { title: title || "Good to know", text } : null
}

/** A short fingerprint of the text, so a new text opens again for someone who folded the old one. */
export function infoFingerprint(info: ScheduleInfo): string {
  let hash = 0
  for (const char of info.title + "\n" + info.text) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return String(hash >>> 0)
}
