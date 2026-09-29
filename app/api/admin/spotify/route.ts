import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { clearRefreshToken, readNowPlaying, readRefreshToken, redirectUriFor, spotifyCredentials } from "@/lib/spotify"

/**
 * The Spotify panel on /admin/obs/widget-settings: is it set up, is an
 * account connected, and what does the strip see right now.
 */

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const configured = spotifyCredentials() !== null
  const redirectUri = redirectUriFor(new URL(request.url).origin)

  let connected = false
  try {
    connected = (await readRefreshToken()) !== null
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the Spotify connection." },
      { status: 503 },
    )
  }

  let nowPlaying = null
  let problem: string | null = null
  if (configured && connected) {
    try {
      nowPlaying = await readNowPlaying()
    } catch (error) {
      problem = error instanceof Error ? error.message : "Spotify did not answer."
    }
  }

  return NextResponse.json({ configured, connected, redirectUri, nowPlaying, problem })
}

/** Disconnect: forget the refresh token. The strip goes quiet at once. */
export async function DELETE() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    await clearRefreshToken()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not disconnect." },
      { status: 500 },
    )
  }
}
