/**
 * What the site says when a sign-in ends without one.
 *
 * The callbacks redirect back with ?auth_error=<code>; components/auth-notice
 * shows the sentence and takes the parameter off the address again. Kept apart
 * from lib/discord-oauth.ts, which is server-only.
 */
export const AUTH_ERRORS: Record<string, string> = {
  discord_unlinked:
    "That Discord account is not linked to an account here yet. Sign in with Kick once, then connect Discord under Profile → Settings.",
  discord_taken: "That Discord account is already linked to a different account here.",
  discord_failed: "Discord sign-in did not go through. Try again.",
  discord_off: "Discord sign-in is not switched on yet.",
  signin_first: "Sign in with Kick first, then connect Discord from your profile.",
}

/** Adds ?auth_error=<code> to a same-site path, keeping any query it has. */
export function withAuthError(path: string, code: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}auth_error=${encodeURIComponent(code)}`
}
