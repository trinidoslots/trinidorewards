import { NextResponse } from "next/server"
import { requireStaff } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { likeExact } from "@/lib/like"

/**
 * Find an account, for the record-a-win dialog.
 *
 * Takes either an onsite id or a username. The id is the reliable one — chat
 * names get changed and two people can pick confusingly similar ones — so the
 * winner log keys on it, and a win entered by hand is entered by id.
 *
 * Null for `user` is still a normal answer when looking up by name: plenty of
 * giveaway winners have never signed in here, and the win is then recorded
 * against the bare username.
 */
export async function GET(request: Request) {
  // Moderators record prediction and tournament winners too (lib/admin-permissions.ts).
  const auth = await requireStaff()
  if (!auth.ok) return auth.response

  const params = new URL(request.url).searchParams
  const id = params.get("id")?.trim()
  const username = params.get("username")?.trim()
  if (!id && !username) return NextResponse.json({ error: "Missing id or username" }, { status: 400 })

  const client = serviceClient()

  // "*" for the same reason as the user page: the table predates every
  // migration, so a named column that is not there fails the request outright.
  const base = client.from("users").select("*")
  const { data: match, error } = id
    ? await base.eq("id", id).maybeSingle()
    : await base.ilike("username", likeExact(username!)).limit(1).maybeSingle()

  if (error) {
    console.error("[v0] Could not look up user:", error)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }

  // Past wins are matched on the name as well as the id, so a run of wins
  // recorded before the account existed still shows up next to this one.
  // An id that matches nothing is an error, unlike a name that does not: the
  // caller typed an id, and there is no bare username to fall back to.
  if (id && !match) return NextResponse.json({ error: "No user with that id" }, { status: 404 })

  const name = match?.username ?? username
  const query = client
    .from("win_logs")
    .select("id, prize, source, created_at")
    .order("created_at", { ascending: false })
    .limit(5)
  const { data: wins } = match
    ? await query.or(`user_id.eq.${match.id}` + (name ? `,username.ilike.${likeExact(name)}` : ""))
    : await query.ilike("username", likeExact(name!))

  // The dialog needs to know who it is; a moderator gets that and no more of
  // the row (balance, rank and whatever else users holds stay admin-only).
  const user =
    match && auth.role !== "admin"
      ? { id: match.id, username: match.username, avatar_url: match.avatar_url ?? null, kick_id: match.kick_id ?? null }
      : match

  return NextResponse.json({ user: user ?? null, recentWins: wins ?? [] })
}
