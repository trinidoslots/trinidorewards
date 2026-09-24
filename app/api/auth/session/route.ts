import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { adminFromUser } from "@/lib/admin-auth"
import { getSiteSession } from "@/lib/site-session"

/**
 * Who is signed in, for the site's own chrome (the top bar, the profile).
 *
 * The user comes from the signed tr_session cookie (lib/site-session.ts);
 * a forged or old unsigned cookie reads as signed out.
 *
 * `is_admin` comes from the verified Supabase session an admin gets at login
 * (lib/admin-auth.ts), and only decides whether the Admin link is shown. The
 * panel checks again.
 */
export async function GET() {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ user: null })

  // users has no public read any more (scripts/072); this row is the signed-in
  // user's own, found by the id in their signed session.
  let userData: Record<string, unknown> | null = null
  try {
    const { data } = await serviceClient().from("users").select("*").eq("id", session.userId).maybeSingle()
    userData = data
  } catch (error) {
    console.error("[session] users read failed:", error)
  }

  // Only admins' requests pay for this: no sb- cookie means no Supabase
  // session, so no auth round-trip.
  let isAdmin = false
  const cookieStore = await cookies()
  if (cookieStore.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const admin = await adminFromUser(user)
    // The admin session has to belong to the same account as the site login,
    // or the bar would offer the panel to whoever signed in last.
    isAdmin = !!admin && admin.kickId === session.kickId && admin.siteUserId === session.userId
  }

  const points = Number(userData?.points_balance) || 0
  return NextResponse.json({
    user: {
      id: session.userId,
      kick_id: session.kickId,
      username: session.username,
      avatar_url: session.avatarUrl,
      points_balance: points,
      created_at: (userData?.created_at as string | undefined) ?? null,
      updated_at: (userData?.updated_at as string | undefined) ?? null,
      is_admin: isAdmin,
    },
    username: session.username,
    points,
    avatar_url: session.avatarUrl,
    is_admin: isAdmin,
  })
}
