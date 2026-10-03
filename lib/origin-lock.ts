/**
 * Only requests that came through Cloudflare reach the site.
 *
 * The domain is proxied by Cloudflare, which forwards to Vercel. Vercel's own
 * addresses (the *.vercel.app URLs of every production deployment) would still
 * answer anyone who calls them directly, around Cloudflare's firewall and
 * rate limits. Cloudflare adds a secret header to everything it forwards (a
 * Transform Rule, "set static" ORIGIN_HEADER); a request without it did not
 * come through Cloudflare and is refused.
 *
 * A shared secret rather than Cloudflare's IP list: Vercel reports the address
 * that connected to it, which can be any of Cloudflare's ranges, and those
 * ranges change. A header Cloudflare sets is one value to keep in step.
 *
 * Off until ORIGIN_SECRET is set, so this can deploy before the Cloudflare
 * rule exists without locking anyone out. Set it for Production only — branch
 * previews are reached on vercel.app on purpose.
 */

export const ORIGIN_HEADER = "x-origin-auth"

/**
 * Let through without the header.
 *
 * The two daily crons are called by Vercel directly, never through Cloudflare.
 * Neither needs the lock: /api/leaderboards/finalize checks CRON_SECRET itself,
 * and the GET on /api/raffles/draw only finishes raffles that are already
 * closed, which any visit to the raffles page does too.
 *
 * Kick's webhook is sent to the vercel.app address, not through Cloudflare:
 * Bot Fight Mode challenges Kick's servers and cannot be skipped on the Free
 * plan. Every delivery is RSA-signed by Kick and checked in the route.
 *
 * The Hunt Tracker extension calls /api/extension/* on the vercel.app address
 * by default (Settings → Connection can switch it to the domain, where Bot
 * Fight Mode may challenge a background fetch). Every route there requires
 * the EXTENSION_API_KEY bearer token, so the lock would add nothing but a 403.
 */
const OPEN_PATHS = [
  "/api/leaderboards/finalize",
  "/api/raffles/draw",
  // Third daily cron: checks CRON_SECRET itself.
  "/api/slots/sync",
  "/api/kick/webhook",
  "/api/extension/",
  "/.well-known/",
]

/** Same answer in the same time whatever was sent, without node:crypto (middleware may run on the edge). */
function sameSecret(given: string, expected: string): boolean {
  let diff = given.length ^ expected.length
  for (let i = 0; i < expected.length; i++) {
    diff |= (given.charCodeAt(i % Math.max(given.length, 1)) || 0) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/** True when the request may continue. */
export function passesOriginLock(pathname: string, headerValue: string | null, secret: string | undefined): boolean {
  if (!secret) return true
  if (OPEN_PATHS.some((open) => pathname === open || (open.endsWith("/") && pathname.startsWith(open)))) return true
  return headerValue !== null && sameSecret(headerValue, secret)
}
