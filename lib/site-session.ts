import crypto from "node:crypto"
import { cookies } from "next/headers"

/**
 * Who is signed in on the site, as a signed cookie.
 *
 * The Kick login used to be four plain cookies: kick_user_id, user_db_id,
 * kick_username, kick_avatar_url. Nothing was signed, so anyone could set
 * user_db_id to somebody else's id in their own browser and spend that
 * person's points, enter raffles as them, or read and change the wallet their
 * payouts go to.
 *
 * Now there is one cookie, tr_session, holding the same facts and an HMAC over
 * them. A cookie that was not issued by this server fails the check and is
 * treated as signed out. The old cookies are no longer read.
 *
 * The key is derived from the Supabase service-role key, which the server
 * already holds and nobody else does, so there is no new secret to configure.
 * SITE_SESSION_SECRET overrides it if you would rather keep them separate.
 * Changing either signs everyone out once.
 */

export const SESSION_COOKIE = "tr_session"

/** Seven days, as the Kick cookies had. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

/** Cookies the site used before tr_session. Cleared at login and logout. */
export const LEGACY_SESSION_COOKIES = ["kick_user_id", "user_db_id", "kick_username", "kick_avatar_url"]

export type SiteSession = {
  /** users.id, the on-site account. */
  userId: string
  /** The Kick id, as Kick reported it at login. */
  kickId: string
  username: string
  avatarUrl: string | null
}

type Payload = { uid: string; kid: string; name: string; av: string | null; exp: number }

function key(): Buffer {
  const secret =
    process.env.SITE_SESSION_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("No secret to sign site sessions with")
  // Derived rather than used directly, so the service key itself never signs
  // anything a browser holds.
  return crypto.createHmac("sha256", secret).update("trinidorewards site session v1").digest()
}

function sign(body: string): string {
  return crypto.createHmac("sha256", key()).update(body).digest("base64url")
}

/** The cookie value for a signed-in user. */
export function encodeSession(session: SiteSession): string {
  const payload: Payload = {
    uid: session.userId,
    kid: session.kickId,
    name: session.username,
    av: session.avatarUrl,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${body}.${sign(body)}`
}

/** The session in a cookie value, or null if it is missing, forged or expired. */
export function decodeSession(value: string | null | undefined): SiteSession | null {
  if (!value) return null
  const dot = value.lastIndexOf(".")
  if (dot <= 0) return null
  const body = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))
  let expected: Buffer
  try {
    expected = Buffer.from(sign(body))
  } catch {
    return null
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null
    if (typeof payload.uid !== "string" || typeof payload.kid !== "string" || typeof payload.name !== "string") return null
    return { userId: payload.uid, kickId: payload.kid, username: payload.name, avatarUrl: payload.av ?? null }
  } catch {
    return null
  }
}

/** The signed-in user for this request, in a route handler or server component. */
export async function getSiteSession(): Promise<SiteSession | null> {
  const store = await cookies()
  return decodeSession(store.get(SESSION_COOKIE)?.value)
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
}
