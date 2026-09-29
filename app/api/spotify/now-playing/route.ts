import { NextResponse } from "next/server"
import { readNowPlaying } from "@/lib/spotify"

/**
 * What the top bar shows next to the Kick followers: the track playing on the
 * streamer's Spotify, or nothing.
 *
 * Public, because the OBS browser source has no admin session. It hands out
 * a title and artist names — what is on stream anyway — and never a token.
 *
 * Any failure reads as "not playing": on an overlay, a missing song line is
 * harmless and an error message is not.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await readNowPlaying(), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[spotify] now playing:", error)
    return NextResponse.json({ playing: false }, { headers: { "Cache-Control": "no-store" } })
  }
}
