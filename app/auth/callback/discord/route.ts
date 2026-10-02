import { NextResponse, type NextRequest } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import {
  LEGACY_SESSION_COOKIES,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  encodeSession,
  getSiteSession,
} from "@/lib/site-session"
import { adminTag, endSupabaseSession, mintAdminSession } from "@/lib/admin-auth"
import { isAdminPath, safeNext } from "@/lib/admin-host"
import { withAuthError } from "@/lib/auth-errors"
import {
  DISCORD_MODE_COOKIE,
  DISCORD_NEXT_COOKIE,
  DISCORD_STATE_COOKIE,
  discordAvatarUrl,
  discordUserFromCode,
} from "@/lib/discord-oauth"

/**
 * Where Discord sends people back.
 *
 * Link: the signed-in account gets this Discord account, unless another
 * account already has it. Login: the account this Discord account is linked
 * to is signed in, with the same session cookie a Kick sign-in sets.
 *
 * Staff get their admin session here too, exactly as on a Kick sign-in
 * (lib/admin-auth.ts). The tag is checked against the linked account's own
 * on-site id and Kick id, read from the database, so Discord can only ever
 * open the panel for the account it was linked to while signed in — never
 * name one.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = safeNext(request.cookies.get(DISCORD_NEXT_COOKIE)?.value, "/")
  const mode = request.cookies.get(DISCORD_MODE_COOKIE)?.value === "link" ? "link" : "login"
  const expected = request.cookies.get(DISCORD_STATE_COOKIE)?.value

  const finish = (target: string) => {
    const response = NextResponse.redirect(new URL(target, request.url))
    response.cookies.delete(DISCORD_STATE_COOKIE)
    response.cookies.delete(DISCORD_MODE_COOKIE)
    response.cookies.delete(DISCORD_NEXT_COOKIE)
    return response
  }

  // Cancelled on the Discord screen: back where they were, nothing to say.
  if (url.searchParams.get("error")) return finish(next)

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state || !expected || state !== expected) return finish(withAuthError(next, "discord_failed"))

  const discord = await discordUserFromCode(url.origin, code)
  if (!discord) return finish(withAuthError(next, "discord_failed"))

  const client = serviceClient()
  const name = discord.global_name || discord.username

  if (mode === "link") {
    const session = await getSiteSession()
    if (!session) return finish(withAuthError(next, "signin_first"))

    const { data: holder } = await client.from("users").select("id").eq("discord_id", discord.id).maybeSingle()
    if (holder && holder.id !== session.userId) return finish(withAuthError(next, "discord_taken"))

    const { error } = await client
      .from("users")
      .update({
        discord_id: discord.id,
        discord_username: name,
        discord_avatar: discordAvatarUrl(discord),
        discord_linked_at: new Date().toISOString(),
      })
      .eq("id", session.userId)
    if (error) {
      // 42703 / PGRST204: scripts/084 has not been run yet.
      console.error("[discord-oauth] link:", error)
      return finish(withAuthError(next, "discord_failed"))
    }
    return finish(`${next}${next.includes("?") ? "&" : "?"}connected=discord`)
  }

  const { data: user, error } = await client
    .from("users")
    .select("id, kick_id, username, avatar_url")
    .eq("discord_id", discord.id)
    .maybeSingle()
  if (error) console.error("[discord-oauth] login lookup:", error)
  if (!user) return finish(withAuthError(next, "discord_unlinked"))

  const response = finish(next)
  const kickId = String(user.kick_id)
  if (await adminTag({ siteUserId: user.id, kickId })) {
    const minted = await mintAdminSession(request, response, {
      kickId,
      siteUserId: user.id,
      username: user.username,
      avatarUrl: user.avatar_url ?? null,
    })
    if (!minted && isAdminPath(next)) {
      response.headers.set("location", new URL("/auth/login?error=admin_session", request.url).toString())
    }
  } else {
    // Signing in as someone else must not leave the last admin's session behind.
    await endSupabaseSession(request, response)
  }
  response.cookies.set(
    SESSION_COOKIE,
    encodeSession({
      userId: user.id,
      kickId: String(user.kick_id),
      username: user.username,
      avatarUrl: user.avatar_url ?? null,
    }),
    SESSION_COOKIE_OPTIONS,
  )
  for (const cookie of LEGACY_SESSION_COOKIES) response.cookies.delete(cookie)
  // Kept fresh on the account, as the Kick picture is on a Kick sign-in.
  await client.from("users").update({ discord_username: name, discord_avatar: discordAvatarUrl(discord) }).eq("id", user.id)
  return response
}
