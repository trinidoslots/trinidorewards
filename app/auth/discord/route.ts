import crypto from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { getSiteSession } from "@/lib/site-session"
import { safeNext } from "@/lib/admin-host"
import { withAuthError } from "@/lib/auth-errors"
import {
  DISCORD_MODE_COOKIE,
  DISCORD_NEXT_COOKIE,
  DISCORD_STATE_COOKIE,
  discordAuthorizeUrl,
  discordConfigured,
} from "@/lib/discord-oauth"

/**
 * Starts a Discord round-trip: ?mode=login to sign in, ?mode=link to attach
 * Discord to the signed-in account. The state and mode travel in httpOnly
 * cookies, so the callback only finishes a round-trip this browser started.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("mode") === "link" ? "link" : "login"
  const next = safeNext(url.searchParams.get("next"), mode === "link" ? "/profile?tab=settings" : "/")

  if (!discordConfigured()) return NextResponse.redirect(new URL(withAuthError(next, "discord_off"), request.url))
  if (mode === "link" && !(await getSiteSession())) {
    return NextResponse.redirect(new URL(withAuthError(next, "signin_first"), request.url))
  }

  const state = crypto.randomBytes(24).toString("base64url")
  const response = NextResponse.redirect(discordAuthorizeUrl(url.origin, state))
  const options = {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  }
  response.cookies.set(DISCORD_STATE_COOKIE, state, options)
  response.cookies.set(DISCORD_MODE_COOKIE, mode, options)
  response.cookies.set(DISCORD_NEXT_COOKIE, next, options)
  return response
}
