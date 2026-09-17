import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"

/**
 * A user's usernames on the casinos they play.
 *
 * Routed the same way as payment methods rather than read straight from the
 * browser. user_site_usernames was created with `auth.uid() = user_id`
 * policies (scripts/021), but this site authenticates with a Kick cookie and
 * never establishes a Supabase auth session — so auth.uid() is null and those
 * policies match nothing. Going through here, where the cookie says who is
 * asking, is what makes the panel work at all.
 */

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("user_db_id")?.value ?? null
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await serviceClient()
    .from("user_site_usernames")
    .select("id, site_name, username, created_at")
    .eq("user_id", userId)
    .order("site_name")

  if (error) {
    console.error("[v0] Could not load site usernames:", error)
    return NextResponse.json({ error: "Could not load your accounts" }, { status: 500 })
  }
  return NextResponse.json({ accounts: data ?? [] })
}

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const site = String(body?.site_name ?? "").trim()
  const username = String(body?.username ?? "").trim()

  if (!site || !username) return NextResponse.json({ error: "Both fields are required" }, { status: 400 })
  if (site.length > 60 || username.length > 60) {
    return NextResponse.json({ error: "That is too long" }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from("user_site_usernames")
    .insert({ user_id: userId, site_name: site, username })
    .select("id, site_name, username, created_at")
    .single()

  if (error) {
    // UNIQUE(user_id, site_name): one username per site, updated rather than
    // added twice.
    const duplicate = (error as { code?: string }).code === "23505"
    console.error("[v0] Could not add site username:", error)
    return NextResponse.json(
      { error: duplicate ? `You already saved a username for ${site}` : "Could not save that username" },
      { status: duplicate ? 409 : 500 },
    )
  }
  return NextResponse.json({ account: data })
}

export async function DELETE(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Scoped by user_id too: without it, any signed-in user could delete someone
  // else's row by guessing a uuid.
  const { error } = await serviceClient()
    .from("user_site_usernames")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    console.error("[v0] Could not delete site username:", error)
    return NextResponse.json({ error: "Could not remove that username" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
