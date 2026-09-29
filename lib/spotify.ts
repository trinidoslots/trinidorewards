import { serviceClient } from "@/lib/supabase/service"

/**
 * The streamer's Spotify, as far as the top bar needs it: what is playing.
 *
 * One account, connected once from /admin/obs/widget-settings with Spotify's
 * authorization-code flow. What that leaves behind is a refresh token, kept in
 * the settings table under REFRESH_TOKEN_KEY. settings already holds secrets
 * and migration 072 lets the public read only three named keys of it, so the
 * token is out of reach of the anon key without a migration of its own.
 *
 * The app's id and secret are env vars (SPOTIFY_CLIENT_ID and
 * SPOTIFY_CLIENT_SECRET) and never leave the server.
 */

export const REFRESH_TOKEN_KEY = "spotify_refresh_token"

/** Read the current track; nothing more is asked for. */
export const SPOTIFY_SCOPES = "user-read-currently-playing"

export const STATE_COOKIE = "spotify_oauth_state"

export type NowPlaying = { playing: false } | { playing: true; title: string; artists: string }

export function spotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim()
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/**
 * Where Spotify sends the admin back to, on the host they started from.
 *
 * Spotify compares this character for character with the list in the app's
 * dashboard, so the settings page prints it for copying rather than asking
 * anyone to guess it.
 */
export function redirectUriFor(origin: string) {
  return `${origin}/api/admin/spotify/callback`
}

export async function readRefreshToken(): Promise<string | null> {
  const { data } = await serviceClient().from("settings").select("value").eq("key", REFRESH_TOKEN_KEY).maybeSingle()
  const value = typeof data?.value === "string" ? data.value.trim() : ""
  return value || null
}

export async function saveRefreshToken(token: string) {
  const { error } = await serviceClient()
    .from("settings")
    .upsert({ key: REFRESH_TOKEN_KEY, value: token }, { onConflict: "key" })
  if (error) throw new Error(error.message)
}

export async function clearRefreshToken() {
  const { error } = await serviceClient().from("settings").delete().eq("key", REFRESH_TOKEN_KEY)
  if (error) throw new Error(error.message)
  accessToken = null
  lastRead = null
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const credentials = spotifyCredentials()
  if (!credentials) throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are not set.")

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as TokenResponse & { error_description?: string }
  if (!response.ok) throw new Error(payload.error_description ?? payload.error ?? `Spotify said ${response.status}.`)
  return payload
}

/** The one-time code from the callback, traded for the refresh token. */
export async function exchangeCode(code: string, redirectUri: string) {
  const payload = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri })
  if (!payload.refresh_token) throw new Error("Spotify sent no refresh token.")
  await saveRefreshToken(payload.refresh_token)
  if (payload.access_token) {
    accessToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 }
  }
}

/*
 * Kept per server instance. An access token lasts an hour, so without this
 * every poll would be two calls to Spotify instead of one.
 */
let accessToken: { value: string; expiresAt: number } | null = null

async function currentAccessToken(): Promise<string | null> {
  // A minute of margin, so a token never expires between here and the call.
  if (accessToken && accessToken.expiresAt - 60_000 > Date.now()) return accessToken.value

  const refreshToken = await readRefreshToken()
  if (!refreshToken) return null

  const payload = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken })
  if (!payload.access_token) throw new Error("Spotify sent no access token.")
  accessToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 }

  // Spotify may rotate the refresh token. The old one stops working when it
  // does, so the new one has to be stored or the next cold start is locked out.
  if (payload.refresh_token && payload.refresh_token !== refreshToken) await saveRefreshToken(payload.refresh_token)

  return accessToken.value
}

/*
 * The last answer, reused for a few seconds.
 *
 * The top bar polls, and it is on more than one OBS scene (it is embedded in
 * /obs/complete too), so several sources can ask at once. Spotify rate-limits
 * per app over a rolling window; this keeps it to one call per interval per
 * instance however many are asking.
 */
const REUSE_MS = 3_000
let lastRead: { at: number; value: NowPlaying } | null = null

type CurrentlyPlaying = {
  is_playing?: boolean
  currently_playing_type?: string
  item?: {
    name?: string
    artists?: { name?: string }[]
    show?: { name?: string }
  } | null
}

export async function readNowPlaying(): Promise<NowPlaying> {
  if (lastRead && Date.now() - lastRead.at < REUSE_MS) return lastRead.value

  const token = await currentAccessToken()
  if (!token) return { playing: false }

  const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (response.status === 401) {
    // Revoked or expired early; the next read fetches a fresh one.
    accessToken = null
    throw new Error("Spotify refused the access token.")
  }
  if (!response.ok && response.status !== 204) throw new Error(`Spotify said ${response.status}.`)

  // 204: nothing is playing, or Spotify is closed.
  const data: CurrentlyPlaying | null = response.status === 204 ? null : await response.json().catch(() => null)
  const item = data?.item
  const title = item?.name?.trim()

  // Paused is is_playing: false with the track still set — the strip hides on
  // that, not only when Spotify is closed. An ad has no item at all.
  let value: NowPlaying = { playing: false }
  if (data?.is_playing && item && title) {
    const artists =
      data.currently_playing_type === "episode"
        ? (item.show?.name ?? "")
        : (item.artists ?? [])
            .map((artist) => artist.name?.trim())
            .filter(Boolean)
            .join(", ")
    value = { playing: true, title, artists }
  }

  lastRead = { at: Date.now(), value }
  return value
}
