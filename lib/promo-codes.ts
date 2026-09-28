import crypto from "node:crypto"

/**
 * Promo codes: what counts as one, and how a random one is made. The storage
 * and the redeeming live in scripts/075.
 */

export type PromoCode = {
  id: string
  code: string
  points: number
  max_uses: number | null
  uses_count: number
  is_active: boolean
  show_on_stream: boolean
  shown_at: string | null
  created_at: string
}

export const MAX_POINTS = 10_000_000

// No 0/O or 1/I/L: a code read off a stream overlay gets typed by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

/** "trinido 100" → "TRINIDO100". Case and spaces are not part of a code. */
export function normalizeCode(input: unknown): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
}

export function isValidCode(code: string): boolean {
  return /^[A-Z0-9_-]{3,32}$/.test(code)
}

/** Ten characters from ALPHABET: ~10^14 combinations, far beyond guessing. */
export function randomCode(length = 10): string {
  let out = ""
  for (let index = 0; index < length; index++) out += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return out
}
