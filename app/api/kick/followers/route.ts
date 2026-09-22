import { NextResponse } from "next/server"

/**
 * A channel's follower count, and whether it is live.
 *
 * Proxied rather than fetched from the widget directly: kick.com sends no
 * CORS header, so a browser source calling it gets nothing, and it wants a
 * browser User-Agent or it answers with a challenge page. Both are handled
 * here, the same way /api/kick/chatroom already does it.
 */

const USER_AGENT = "Mozilla/5.0"

/** Kick's own number moves slowly; a minute of cache keeps the widget off it. */
export const revalidate = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")?.trim()

  if (!slug) {
    return NextResponse.json({ error: "Missing required query param: slug" }, { status: 400 })
  }

  try {
    const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to read channel "${slug}" (status ${response.status})` },
        { status: response.status === 404 ? 404 : 502 },
      )
    }

    const data = await response.json()

    // Kick types this field inconsistently: the same channel comes back as
    // followers_count: 7 on one request and "7" on the next — two responses
    // that differed by exactly the two quote characters. So coerce, but only
    // from a number or a numeric string. Not with Number() alone, which turns
    // null into 0 and would put a confident zero on the overlay.
    const raw = data?.followers_count ?? data?.followersCount
    const followers =
      typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "") ? Number(raw) : Number.NaN

    if (!Number.isFinite(followers)) {
      return NextResponse.json({ error: `No follower count for "${slug}"` }, { status: 404 })
    }

    return NextResponse.json({
      followers,
      // livestream is null when the channel is offline.
      live: Boolean(data?.livestream?.is_live ?? data?.livestream),
      viewers: Number(data?.livestream?.viewer_count) || 0,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read follower count" },
      { status: 502 },
    )
  }
}
