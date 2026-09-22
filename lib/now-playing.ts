/**
 * The slot currently on screen.
 *
 * The normalising lives here rather than in either route, because the same
 * values arrive from two places — the extension scraping a casino page, and an
 * admin typing into a form — and they have to end up identical. A bar that
 * reads differently depending on which button set it is worse than no bar.
 */

export type NowPlayingSource = "extension" | "admin"

export type NowPlayingRow = {
  id: number
  /** null means nothing is playing, and the overlay renders nothing. */
  slot_name: string | null
  provider: string | null
  image_url: string | null
  /** As written on the casino's page, e.g. "25,000x". */
  max_win: string | null
  /** e.g. "Only on Stake". */
  badge: string | null
  source: NowPlayingSource
  updated_at: string
}

export const LIMITS = {
  slotName: 90,
  provider: 60,
  badge: 40,
  maxWin: 20,
  imageUrl: 500,
} as const

/** Trims, collapses inner whitespace, caps the length, empties to null. */
export function cleanText(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null
  // Scraped text arrives with newlines and runs of spaces in it — the casino
  // lays the row out with flexbox, not with single spaces.
  const collapsed = value.replace(/\s+/g, " ").trim()
  if (!collapsed) return null
  return collapsed.slice(0, limit)
}

/**
 * Normalises a max-win label.
 *
 * Accepts what the page shows ("25,000x", "Potential 25,000x", "25000 x") and
 * a bare number (25000), and always comes back with a trailing x. A number is
 * grouped with commas so a typed 25000 matches a scraped 25,000x rather than
 * sitting next to it looking like a different game.
 */
export function cleanMaxWin(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null
    return `${value.toLocaleString("en-US")}x`
  }
  if (typeof value !== "string") return null

  const collapsed = value.replace(/\s+/g, " ").trim()
  if (!collapsed) return null

  // Pull the figure out of whatever wrapping it came in.
  const match = collapsed.match(/([\d][\d.,]*)\s*x?/i)
  if (!match) return null

  const figure = match[1].replace(/[.,]$/, "")
  const digits = Number(figure.replace(/,/g, ""))
  if (Number.isFinite(digits) && digits > 0) return `${digits.toLocaleString("en-US")}x`

  return `${figure}x`.slice(0, LIMITS.maxWin)
}

/** Only http(s) survives — a data: URI would blow past the column and the wire. */
export function cleanImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  if (trimmed.length > LIMITS.imageUrl) return null
  return trimmed
}

/** True when there is something to draw. */
export function isPlaying(row: NowPlayingRow | null): row is NowPlayingRow {
  return !!row && typeof row.slot_name === "string" && row.slot_name.trim().length > 0
}

/**
 * Builds the row patch from either caller's payload.
 *
 * Returns every field, so setting a new game never leaves the previous game's
 * provider or max win hanging underneath it — the one failure mode that would
 * put a wrong number on stream rather than merely a missing one.
 */
export function readNowPlaying(
  body: Record<string, unknown>,
  source: NowPlayingSource,
): Omit<NowPlayingRow, "id" | "updated_at"> {
  return {
    slot_name: cleanText(body.slot_name, LIMITS.slotName),
    provider: cleanText(body.provider, LIMITS.provider),
    image_url: cleanImageUrl(body.image_url),
    max_win: cleanMaxWin(body.max_win),
    badge: cleanText(body.badge, LIMITS.badge),
    source,
  }
}
