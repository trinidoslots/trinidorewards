import { type NextRequest, NextResponse } from "next/server"
import { endSupabaseSession } from "@/lib/admin-auth"
import { LEGACY_SESSION_COOKIES, SESSION_COOKIE } from "@/lib/site-session"

/**
 * Signs out of everything: the site session (tr_session, and the unsigned
 * cookies it replaced), and the Supabase session an admin has on top.
 *
 * POST, not GET: a sign-out link that any page could embed as an image would
 * sign people out behind their back.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  for (const name of LEGACY_SESSION_COOKIES) response.cookies.delete(name)
  await endSupabaseSession(request, response)
  return response
}
