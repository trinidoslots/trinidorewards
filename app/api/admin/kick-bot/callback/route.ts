import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { adminHref } from "@/lib/admin-host"
import {
  KICK_BOT_COOKIE_PATH,
  KICK_BOT_STATE_COOKIE,
  KICK_BOT_VERIFIER_COOKIE,
  exchangeBotCode,
  kickBotRedirectUri,
} from "@/lib/kick-bot/client"

/** Where Kick returns the admin: trade the code, store the token, back to the Kick bot page. */

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const back = (outcome: string, detail?: string) => {
    const target = new URL(adminHref("/admin/kick-bot"), url.origin)
    target.searchParams.set("bot", outcome)
    if (detail) target.searchParams.set("detail", detail.slice(0, 200))
    const response = NextResponse.redirect(target)
    response.cookies.delete({ name: KICK_BOT_STATE_COOKIE, path: KICK_BOT_COOKIE_PATH })
    response.cookies.delete({ name: KICK_BOT_VERIFIER_COOKIE, path: KICK_BOT_COOKIE_PATH })
    return response
  }

  const expected = request.cookies.get(KICK_BOT_STATE_COOKIE)?.value
  const verifier = request.cookies.get(KICK_BOT_VERIFIER_COOKIE)?.value
  if (!expected || !verifier || url.searchParams.get("state") !== expected) {
    return back("error", "The sign-in expired. Try again.")
  }

  const refused = url.searchParams.get("error")
  if (refused) return back("error", refused === "access_denied" ? "Access was not allowed on Kick." : refused)

  const code = url.searchParams.get("code")
  if (!code) return back("error", "Kick sent no code.")

  try {
    await exchangeBotCode(code, kickBotRedirectUri(url.origin), verifier)
    return back("connected")
  } catch (error) {
    return back("error", error instanceof Error ? error.message : "Could not connect the bot.")
  }
}
