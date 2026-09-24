import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"

/**
 * The signed-in user's own wins.
 *
 * Matched on the account id *and* the username: a win recorded before they
 * first signed in was only ever attached to a name, and it is still theirs.
 */
export async function GET() {
  const cookieStore = await cookies()
  const userId = (await getSiteSession())?.userId
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = serviceClient()
  const { data: user } = await client.from("users").select("username").eq("id", userId).maybeSingle()

  let query = client
    .from("win_logs")
    .select("id, username, source, source_ref, prize, amount, points, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  query = user?.username ? query.or(`user_id.eq.${userId},username.ilike.${user.username}`) : query.eq("user_id", userId)

  const { data, error } = await query
  if (error) {
    console.error("[v0] Could not load wins:", error)
    return NextResponse.json({ error: "Could not load your wins" }, { status: 500 })
  }
  return NextResponse.json({ wins: data ?? [] })
}
