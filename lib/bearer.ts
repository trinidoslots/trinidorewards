import crypto from "node:crypto"

/**
 * Whether a request carries `Bearer <expected>`, compared in constant time.
 *
 * The machine routes (extension, Stream Deck, Botrix, cron) each compared
 * their token with ===, which stops at the first differing character. Over
 * the internet that timing is noisy, but it is the textbook way a token leaks
 * one byte at a time, and the fix is one line. Both sides are hashed first so
 * the comparison takes the same time whatever length was sent.
 *
 * An unset `expected` never matches: a route whose secret is missing is off,
 * not open.
 */
export function bearerMatches(request: Request, expected: string | undefined): boolean {
  if (!expected) return false
  const header = request.headers.get("authorization") ?? ""
  if (!header.startsWith("Bearer ")) return false
  const given = crypto.createHash("sha256").update(header.slice(7)).digest()
  const wanted = crypto.createHash("sha256").update(expected).digest()
  return crypto.timingSafeEqual(given, wanted)
}
