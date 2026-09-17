/**
 * Converting between a `datetime-local` input and a stored instant.
 *
 * The input has no timezone, so sending its raw string has the database read
 * it as UTC — an entry made at 20:00 in Berlin gets stored as 20:00Z and
 * announced two hours late.
 */

/** A local datetime-local value as an instant, or null when left empty. */
export function toInstant(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** An instant back into the shape datetime-local expects, in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
