import { NextResponse } from "next/server"

const USER_AGENT = "Mozilla/5.0"

// Best-effort avatar lookup: most Kick usernames double as channel slugs, so we
// reuse the public channel endpoint to pull a profile picture. Callers should
// treat a null avatar as expected (not every entrant has a matching channel).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get("username")?.trim()

  if (!username) {
    return NextResponse.json({ error: "Missing required query param: username" }, { status: 400 })
  }

  try {
    const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(username)}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({ avatar: null })
    }

    const data = await response.json()
    const avatar = data?.user?.profile_pic ?? null
    return NextResponse.json({ avatar: typeof avatar === "string" ? avatar : null })
  } catch {
    return NextResponse.json({ avatar: null })
  }
}
