/**
 * Starts "Sign in with Kick". Browser-only.
 *
 * Shared by the login dialog on the site and the admin login page, so both
 * run the same PKCE flow and the callback only has one shape of request to
 * expect.
 *
 * Three short-lived cookies travel with the round-trip:
 *
 *   - kick_code_verifier  the PKCE secret the callback redeems the code with
 *   - kick_oauth_state    checked against the state Kick hands back, so a
 *                         callback nobody here started is refused
 *   - kick_login_next     where to land afterwards (the admin page asks for
 *                         /admin); the callback only honours a same-site path
 */

function randomString(length: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

function setShortCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=600; SameSite=Lax${secure}`
}

export async function startKickLogin(next = "/"): Promise<void> {
  const verifier = randomString(128)
  const state = randomString(32)

  setShortCookie("kick_code_verifier", verifier)
  setShortCookie("kick_oauth_state", state)
  setShortCookie("kick_login_next", next)

  const url = new URL("https://id.kick.com/oauth/authorize")
  url.searchParams.set("client_id", process.env.NEXT_PUBLIC_KICK_CLIENT_ID!)
  url.searchParams.set("redirect_uri", `${window.location.origin}/auth/callback/kick`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("state", state)
  url.searchParams.set("scope", "user:read")
  url.searchParams.set("code_challenge", await codeChallenge(verifier))
  url.searchParams.set("code_challenge_method", "S256")

  window.location.href = url.toString()
}
