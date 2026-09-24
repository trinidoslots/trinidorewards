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
  /** Biggest payout ever recorded for this game, in dollars. */
  best_win: number | null
  updated_at: string
}

/**
 * The key a game is remembered under.
 *
 * Case and inner whitespace are not identity: "Loan Shark", "loan shark" and
 * " Loan  Shark " are one game, and a scrape that picks up a stray newline
 * should not create a second row that knows nothing.
 */
export function nameKey(name: string | null | undefined): string {
  return (name ?? "").replace(/\s+/g, " ").trim().toLowerCase()
}

/** "$31,665" — whole dollars, as the reference bar shows it. */
export function formatMoney(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
  return "$" + Math.round(value).toLocaleString("en-US")
}

/** Reads a money figure typed into the admin form. */
export function readMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null
  if (typeof value !== "string") return null
  const cleaned = value.replace(/[$\s,]/g, "")
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Reads a multiplier typed into the admin form: "172x", "172", "1,234.5 x".
 * Comma is a thousands separator here, as in every figure the casino shows.
 */
export function readMultiplier(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null
  if (typeof value !== "string") return null
  const cleaned = value.replace(/[x×\s,]/gi, "")
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
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

/**
 * The "Only on Stake" chip, sampled out of the reference screenshot.
 *
 * A left-to-right gradient, not a flat fill, and a rounded rectangle, not a
 * pill: the badge measures 77x18 there, and the fill reaches the left edge by
 * the fourth row down, which is a radius of about 5px — 0.28 of its own height,
 * where a pill would be 0.5.
 */
export const BADGE_GRADIENT = "linear-gradient(90deg, #65FAE7 0%, #26C4F4 50%, #0E81E5 100%)"
export const BADGE_TEXT = "#021D29"

/**
 * Turns a Postgres error into something that says what to do about it.
 *
 * "Could not read what is playing." is true and useless. The overwhelmingly
 * likely cause the first time is that the migration has not been run — the
 * table simply is not there — and that is a thirty-second fix once you know
 * that is what you are looking at.
 *
 * 42P01 is Postgres' undefined_table; PGRST205 is PostgREST failing to find it
 * in its schema cache, which is what actually comes back through supabase-js.
 */
export function explainDbError(error: { code?: string; message?: string } | null, fallback: string): string {
  const code = error?.code ?? ""
  const message = error?.message ?? ""

  // Name the script that creates whichever table is missing, rather than always
  // naming the first one — by 067 there are two, and sending someone to re-run
  // a migration they have already run is worse than the generic message.
  const missing = code === "42P01" || code === "PGRST205" || /does not exist/i.test(message)
  if (missing) {
    if (/slot_meta/i.test(message)) {
      return "The slot_meta table does not exist yet — run scripts/067_slot_meta_and_best_win.sql in Supabase."
    }
    if (/now_playing/i.test(message) || code === "42P01" || code === "PGRST205") {
      return "The now_playing table does not exist yet — run scripts/066_now_playing.sql in Supabase."
    }
  }

  // A column missing means 066 ran but 067 did not.
  if (code === "42703" || code === "PGRST204") {
    if (/best_win/i.test(message)) {
      return "now_playing has no best_win column yet — run scripts/067_slot_meta_and_best_win.sql in Supabase."
    }
  }

  return fallback
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
): Omit<NowPlayingRow, "id" | "updated_at" | "best_win"> {
  return {
    slot_name: cleanText(body.slot_name, LIMITS.slotName),
    provider: cleanText(body.provider, LIMITS.provider),
    image_url: cleanImageUrl(body.image_url),
    max_win: cleanMaxWin(body.max_win),
    badge: cleanText(body.badge, LIMITS.badge),
    source,
  }
}

/**
 * Fills the gaps in a scrape from what we already know about the game.
 *
 * The scrape wins whenever it found something — the page is the live truth for
 * a game whose multiplier was rebalanced. Everything it missed falls back to
 * the remembered row, which is the whole point: the badge and the multiplier
 * come out of the page's visible text and do not survive every layout change,
 * and a bar missing half its fields on every slot switch is what this fixes.
 */
export function mergeWithKnown<T extends Record<string, unknown>>(
  scraped: T,
  known: Partial<Record<keyof T, unknown>> | null,
): T {
  if (!known) return scraped
  const merged = { ...scraped }
  for (const field of ["provider", "max_win", "badge", "image_url"] as const) {
    if (merged[field] == null && known[field as keyof T] != null) {
      ;(merged as Record<string, unknown>)[field] = known[field as keyof T]
    }
  }
  return merged
}
