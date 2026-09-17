import { NextResponse } from "next/server"

const USER_AGENT = "Mozilla/5.0"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")?.trim()

  if (!slug) {
    return NextResponse.json({ error: "Missing required query param: slug" }, { status: 400 })
  }

  try {
    const popoutResponse = await fetch(`https://kick.com/popout/${slug}/chat`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    })

    if (popoutResponse.ok) {
      const html = await popoutResponse.text()
      const match = html.match(/"chatroom":\s*{\s*"id":\s*(\d+)/)
      if (match) {
        return NextResponse.json({ chatroomId: Number(match[1]) })
      }
    }
  } catch {
    // fall through to API fallback
  }

  try {
    const apiResponse = await fetch(`https://kick.com/api/v2/channels/${slug}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    })

    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: `Failed to resolve channel "${slug}" (status ${apiResponse.status})` },
        { status: apiResponse.status === 404 ? 404 : 502 },
      )
    }

    const data = await apiResponse.json()
    const chatroomId = data?.chatroom?.id

    if (typeof chatroomId !== "number") {
      return NextResponse.json({ error: `Could not find a chatroom for "${slug}"` }, { status: 404 })
    }

    return NextResponse.json({ chatroomId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve chatroom id" },
      { status: 502 },
    )
  }
}
