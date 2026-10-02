/**
 * "Continue with Discord" and linking Discord to an account.
 *
 * The same Discord application as the bot (DISCORD_APPLICATION_ID), with its
 * OAuth2 client secret in DISCORD_CLIENT_SECRET. Only the `identify` scope:
 * the id, username and avatar — no email, no servers, nothing posted.
 *
 * Server-only. The redirect URI is built from the request's own origin, so
 * the production domain, the staging preview and localhost each send people
 * back to themselves; each has to be listed under OAuth2 > Redirects in the
 * Discord developer portal.
 */

export const DISCORD_STATE_COOKIE = "discord_oauth_state"
export const DISCORD_MODE_COOKIE = "discord_oauth_mode"
export const DISCORD_NEXT_COOKIE = "discord_oauth_next"

export type DiscordMode = "login" | "link"

export type DiscordUser = { id: string; username: string; global_name: string | null; avatar: string | null }

export function discordConfigured(): boolean {
  return !!(process.env.DISCORD_APPLICATION_ID && process.env.DISCORD_CLIENT_SECRET)
}

export function discordRedirectUri(origin: string): string {
  return `${origin}/auth/callback/discord`
}

export function discordAuthorizeUrl(origin: string, state: string): string {
  const url = new URL("https://discord.com/oauth2/authorize")
  url.searchParams.set("client_id", process.env.DISCORD_APPLICATION_ID ?? "")
  url.searchParams.set("redirect_uri", discordRedirectUri(origin))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "identify")
  url.searchParams.set("state", state)
  url.searchParams.set("prompt", "none")
  return url.toString()
}

/** Trades the code for a token and reads who it belongs to. Null when either step fails. */
export async function discordUserFromCode(origin: string, code: string): Promise<DiscordUser | null> {
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_APPLICATION_ID ?? "",
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri(origin),
    }),
  })
  if (!tokenResponse.ok) {
    console.error("[discord-oauth] token exchange failed:", tokenResponse.status, (await tokenResponse.text()).slice(0, 200))
    return null
  }
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string }
  if (!accessToken) return null

  const meResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!meResponse.ok) {
    console.error("[discord-oauth] /users/@me failed:", meResponse.status)
    return null
  }
  const me = (await meResponse.json()) as Partial<DiscordUser>
  if (!me.id || !me.username) return null
  return { id: String(me.id), username: me.username, global_name: me.global_name ?? null, avatar: me.avatar ?? null }
}

/** The avatar's CDN address, or null for the default one. */
export function discordAvatarUrl(user: Pick<DiscordUser, "id" | "avatar">): string | null {
  return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null
}
