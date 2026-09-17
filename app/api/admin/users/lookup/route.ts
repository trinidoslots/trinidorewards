import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"

/**
 * Find the account behind a winner's name, for the record-a-win dialog.
 *
 * Winners arrive as Kick chat names. Returning null for `user` is a normal
 * answer, not an error — plenty of giveaway winners have never signed in here —
 * so the caller can still record the win against the bare username.
 */
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user: admin },
  } = await supabase.auth.getUser()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const username = new URL(request.url).searchParams.get("username")?.trim()
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 })

  const client = serviceClient()

  const { data: match, error } = await client
    .from("users")
    .select("id, username, kick_id, avatar_url, points_balance, created_at")
    .ilike("username", username)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[v0] Could not look up user:", error)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }

  // Past wins are matched on the name as well as the id, so a run of wins
  // recorded before the account existed still shows up next to this one.
  const query = client.from("win_logs").select("id, prize, source, created_at").order("created_at", { ascending: false }).limit(5)
  const { data: wins } = match
    ? await query.or(`user_id.eq.${match.id},username.ilike.${username}`)
    : await query.ilike("username", username)

  return NextResponse.json({ user: match ?? null, recentWins: wins ?? [] })
}
