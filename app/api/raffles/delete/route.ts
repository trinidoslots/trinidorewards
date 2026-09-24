import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient()
    const { raffleId } = await request.json()

    // Deleting a raffle is an admin action. This used to accept any signed-in
    // visitor: the user_db_id cookie alone was enough, and it is not signed.
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    console.log("[v0] Deleting raffle:", raffleId, "by", auth.email)

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
