import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { adminHref } from "@/lib/admin-host"
import {
  KICK_BOT_COOKIE_PATH,
  KICK_BOT_SCOPES,
  KICK_BOT_STATE_COOKIE,
  KICK_BOT_VERIFIER_COOKIE,
  kickBotCredentials,
  kickBotRedirectUri,
} from "@/lib/kick-bot/client"

/**
 * Sends the admin to Kick to let @TrinidoRewards post in the channel.
 *
 * Has to be done signed in to Kick as the streamer: bot messages land in the
 * channel of whoever authorises. Kick requires PKCE; the verifier and the
 * state stay in short-lived httpOnly cookies scoped to these routes.
 */

export const dynamic = "force-dynamic"

const base64url = (buffer: Buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const origin = new URL(request.url).origin
  const credentials = kickBotCredentials()
  if (!credentials) return NextResponse.redirect(`${origin}${adminHref("/admin/kick-bot")}?bot=unconfigured`)

  const verifier = base64url(crypto.randomBytes(64))
  const state = base64url(crypto.randomBytes(24))
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest())

  const authorize = new URL("https://id.kick.com/oauth/authorize")
  authorize.searchParams.set("client_id", credentials.clientId)
  authorize.searchParams.set("redirect_uri", kickBotRedirectUri(origin))
  authorize.searchParams.set("response_type", "code")
  authorize.searchParams.set("scope", KICK_BOT_SCOPES)
  authorize.searchParams.set("state", state)
  authorize.searchParams.set("code_challenge", challenge)
  authorize.searchParams.set("code_challenge_method", "S256")

  const response = NextResponse.redirect(authorize.toString())
  const cookie = {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    // Lax: the way back is a top-level redirect from Kick.
    sameSite: "lax" as const,
    path: KICK_BOT_COOKIE_PATH,
    maxAge: 600,
  }
  response.cookies.set(KICK_BOT_STATE_COOKIE, state, cookie)
  response.cookies.set(KICK_BOT_VERIFIER_COOKIE, verifier, cookie)
  return response
}
