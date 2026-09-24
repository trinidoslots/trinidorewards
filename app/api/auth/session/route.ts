import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminFromUser } from "@/lib/admin-auth"

/**
 * Who is signed in, for the site's own chrome (the top bar, the profile).
 *
 * `is_admin` is not read from the Kick cookies, which anyone can set. It comes
 * from the verified Supabase session an admin gets at login (lib/admin-auth.ts),
 * and only decides whether the Admin link is shown — the panel checks again.
 */
export async function GET() {
  const cookieStore = await cookies()
  const kickUserId = cookieStore.get("kick_user_id")
  const userDbId = cookieStore.get("user_db_id")
  const kickUsername = cookieStore.get("kick_username")
  const kickAvatar = cookieStore.get("kick_avatar_url")

  if (kickUserId && kickUsername && userDbId) {
    const supabase = await createClient()

    const { data: userData } = await supabase.from("users").select("*").eq("id", userDbId.value).single()

    // Only non-admins' requests skip this, and they are nearly all of them:
    // no sb- cookie means no Supabase session, so no auth round-trip.
    let isAdmin = false
    if (cookieStore.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const admin = await adminFromUser(user)
      // The admin session has to belong to the same Kick account as the site
      // login, or the bar would offer the panel to whoever signed in last.
      isAdmin = !!admin && admin.kickId === kickUserId.value
    }

    return NextResponse.json({
      user: {
        id: userDbId.value,
        kick_id: kickUserId.value,
        username: kickUsername.value,
        avatar_url: kickAvatar?.value || null,
        points_balance: userData?.points_balance || 0,
        created_at: userData?.created_at ?? null,
        updated_at: userData?.updated_at ?? null,
        is_admin: isAdmin,
      },
      username: kickUsername.value,
      points: userData?.points_balance || 0,
      avatar_url: kickAvatar?.value || null,
      is_admin: isAdmin,
    })
  }

  return NextResponse.json({ user: null })
}
