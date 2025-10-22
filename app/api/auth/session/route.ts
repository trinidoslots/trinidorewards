import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const cookieStore = await cookies()
  const kickUserId = cookieStore.get("kick_user_id")
  const userDbId = cookieStore.get("user_db_id")
  const kickUsername = cookieStore.get("kick_username")
  const kickAvatar = cookieStore.get("kick_avatar_url")

  if (kickUserId && kickUsername && userDbId) {
    const supabase = await createClient()

    const { data: userData } = await supabase.from("users").select("*").eq("id", userDbId.value).single()

    return NextResponse.json({
      user: {
        id: userDbId.value,
        kick_id: kickUserId.value,
        username: kickUsername.value,
        avatar_url: kickAvatar?.value || null,
        points_balance: userData?.points_balance || 0,
      },
      username: kickUsername.value,
      points: userData?.points_balance || 0,
      avatar_url: kickAvatar?.value || null,
    })
  }

  return NextResponse.json({ user: null })
}
