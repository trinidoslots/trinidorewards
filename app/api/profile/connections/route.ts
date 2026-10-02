import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { discordConfigured } from "@/lib/discord-oauth"

/**
 * The accounts linked to the signed-in user: Kick (what the account is) and
 * Discord (a second way in). DELETE ?provider=discord unlinks Discord.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await serviceClient()
    .from("users")
    .select("username, avatar_url, discord_id, discord_username, discord_avatar, discord_linked_at")
    .eq("id", session.userId)
    .maybeSingle()

  // Before scripts/084 the discord columns do not exist; Kick still shows.
  const row = (error ? null : data) as Record<string, string | null> | null

  return NextResponse.json({
    kick: { username: row?.username ?? session.username, avatar: row?.avatar_url ?? session.avatarUrl ?? null },
    discord: row?.discord_id
      ? { username: row.discord_username, avatar: row.discord_avatar, linkedAt: row.discord_linked_at }
      : null,
    discordAvailable: discordConfigured() && !error,
  })
}

export async function DELETE(request: Request) {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (new URL(request.url).searchParams.get("provider") !== "discord") {
    return NextResponse.json({ error: "Only Discord can be disconnected." }, { status: 400 })
  }
  const { error } = await serviceClient()
    .from("users")
    .update({ discord_id: null, discord_username: null, discord_avatar: null, discord_linked_at: null })
    .eq("id", session.userId)
  if (error) return NextResponse.json({ error: "Could not disconnect Discord." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
