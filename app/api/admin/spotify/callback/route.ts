import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { STATE_COOKIE, exchangeCode, redirectUriFor } from "@/lib/spotify"

/**
 * Where Spotify returns the admin: trade the code for a refresh token, store
 * it, and go back to the settings page with the outcome in the query string.
 */

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const back = (outcome: string, detail?: string) => {
    const target = new URL("/admin/obs/widget-settings", url.origin)
    target.searchParams.set("spotify", outcome)
    if (detail) target.searchParams.set("detail", detail.slice(0, 200))
    const response = NextResponse.redirect(target)
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/admin/spotify" })
    return response
  }

  const expected = request.cookies.get(STATE_COOKIE)?.value
  if (!expected || url.searchParams.get("state") !== expected) return back("error", "The sign-in expired. Try again.")

  // "access_denied" when the admin pressed Cancel on Spotify's page.
  const refused = url.searchParams.get("error")
  if (refused) return back("error", refused === "access_denied" ? "Spotify access was not allowed." : refused)

  const code = url.searchParams.get("code")
  if (!code) return back("error", "Spotify sent no code.")

  try {
    await exchangeCode(code, redirectUriFor(url.origin))
    return back("connected")
  } catch (error) {
    return back("error", error instanceof Error ? error.message : "Could not connect Spotify.")
  }
}
