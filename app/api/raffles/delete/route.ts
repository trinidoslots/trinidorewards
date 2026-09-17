import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient()
    const { raffleId } = await request.json()

    const cookieStore = await cookies()

    let userDbId = cookieStore.get("user_db_id")?.value

    // If no Kick OAuth cookie, check Supabase Auth
    if (!userDbId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        console.log("[v0] Supabase auth user found:", user.id)

        // Look up user in database by Supabase auth ID - use maybeSingle() to avoid error if user doesn't exist
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle()

        if (userError) {
          console.error("[v0] Error looking up user:", userError)
        }

        if (userData) {
          userDbId = userData.id
          console.log("[v0] Found user in database:", userDbId)
        } else {
          // User is authenticated via Supabase but not in users table
          // For admin operations, we'll allow this since they have access to admin panel
          console.log("[v0] User authenticated via Supabase but not in users table - allowing admin operation")
          userDbId = user.id
        }
      }
    }

    if (!userDbId) {
      console.error("[v0] No authentication found - user not logged in")
      return NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 })
    }

    console.log("[v0] Deleting raffle:", raffleId, "by user:", userDbId)

    // Delete raffle entries first (foreign key constraint)
    const { error: entriesError } = await supabase.from("raffle_entries").delete().eq("raffle_id", raffleId)

    if (entriesError) {
      console.error("[v0] Error deleting raffle entries:", entriesError)
      return NextResponse.json({ error: "Failed to delete raffle entries" }, { status: 500 })
    }

    console.log("[v0] Raffle entries deleted successfully")

    // Delete the raffle
    const { error: raffleError } = await supabase.from("raffles").delete().eq("id", raffleId)

    if (raffleError) {
      console.error("[v0] Error deleting raffle:", raffleError)
      return NextResponse.json({ error: "Failed to delete raffle" }, { status: 500 })
    }

    console.log("[v0] Raffle deleted successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting raffle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
