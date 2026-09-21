/**
 * Shortening a player name for public display.
 *
 * The external feed hands back whatever the player signed up with, and a fair
 * number of those are email addresses with the "@" stripped —
 * "games4u2009gmail" is a real entry. Printing those on a public page hands out
 * an address book, so the board shows the ends of a name and hides the middle:
 * enough for someone to recognise their own row, not enough to read as a
 * contact detail.
 *
 * The shape is first three, three stars, last three — "gam***ail".
 *
 * Short names are the awkward case, and taking that rule literally breaks on
 * them. "WhoDet" is six characters: first three plus last three is the entire
 * name, printed longer than the original and hiding nothing. So the number of
 * characters shown per side shrinks until at least three stay hidden, and a
 * name too short for even one to be hidden is replaced outright. The headline
 * case — a long name — is unaffected and still masks to exactly three.
 */

/** Characters that always stay hidden, whatever the name's length. */
const HIDDEN_MINIMUM = 3

/** The most characters shown on either side. */
const VISIBLE_MAXIMUM = 3

export const MASK = "***"

/**
 * How many characters may be shown at each end of a name of this length.
 * Zero means nothing can be shown without revealing the whole name.
 */
export function visiblePerSide(length: number): number {
  if (!Number.isFinite(length) || length <= 0) return 0
  return Math.max(0, Math.min(VISIBLE_MAXIMUM, Math.floor((length - HIDDEN_MINIMUM) / 2)))
}

/**
 * "games4u2009gmail" as "gam***ail".
 *
 * Empty, missing and whitespace-only names come back as the bare mask rather
 * than an empty string, so a row never renders as a blank cell.
 */
export function maskUsername(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim()
  if (!trimmed) return MASK

  // Count by code point, not by UTF-16 unit: slicing a name that starts with an
  // emoji or an astral character halfway through a surrogate pair yields a
  // replacement glyph.
  const characters = Array.from(trimmed)
  const visible = visiblePerSide(characters.length)
  if (visible === 0) return MASK

  return characters.slice(0, visible).join("") + MASK + characters.slice(-visible).join("")
}
