import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { SPOTIFY_SCOPES, STATE_COOKIE, redirectUriFor, spotifyCredentials } from "@/lib/spotify"

/**
 * Sends the admin to Spotify to allow the site to read what is playing.
 *
 * A plain link from the settings page lands here. The state value is kept in
 * a short-lived cookie and checked by the callback, so a callback URL that
 * someone else started cannot connect their account instead.
 */

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const credentials = spotifyCredentials()
  const origin = new URL(request.url).origin
  if (!credentials) {
    return NextResponse.redirect(`${origin}/admin/obs/widget-settings?spotify=unconfigured`)
  }

  const state = crypto.randomUUID()
  const authorize = new URL("https://accounts.spotify.com/authorize")
  authorize.searchParams.set("response_type", "code")
  authorize.searchParams.set("client_id", credentials.clientId)
  authorize.searchParams.set("scope", SPOTIFY_SCOPES)
  authorize.searchParams.set("redirect_uri", redirectUriFor(origin))
  authorize.searchParams.set("state", state)

  const response = NextResponse.redirect(authorize.toString())
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    // Lax, not Strict: the way back is a top-level redirect from Spotify, and
    // Strict would leave the cookie behind on exactly that request.
    sameSite: "lax",
    path: "/api/admin/spotify",
    maxAge: 600,
  })
  return response
}
