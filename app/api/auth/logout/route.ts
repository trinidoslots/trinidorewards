import { type NextRequest, NextResponse } from "next/server"
import { endSupabaseSession } from "@/lib/admin-auth"

/**
 * Signs out of everything: the Kick cookies the site runs on, and the
 * Supabase session an admin has on top of them.
 *
 * POST, not GET: a sign-out link that any page could embed as an image would
 * sign people out behind their back.
 */

const KICK_COOKIES = ["kick_user_id", "user_db_id", "kick_username", "kick_avatar_url"]

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  for (const name of KICK_COOKIES) response.cookies.delete(name)
  await endSupabaseSession(request, response)
  return response
}
