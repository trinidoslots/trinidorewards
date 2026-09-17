import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { raffleId } = await request.json()

    const cookieStore = await cookies()
    const userDbId = cookieStore.get("user_db_id")?.value

    if (!userDbId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Entering raffle - User ID:", userDbId, "Raffle ID:", raffleId)

    // Get user data using the database ID from cookies
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, username, points_balance")
      .eq("id", userDbId)
      .single()

    if (userError || !userData) {
      console.error("[v0] User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[v0] User found:", userData.username, "Balance:", userData.points_balance)

    // Get raffle data
    const { data: raffle, error: raffleError } = await supabase.from("raffles").select("*").eq("id", raffleId).single()

    if (raffleError || !raffle) {
      console.error("[v0] Raffle not found:", raffleError)
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 })
    }

    console.log("[v0] Raffle found:", raffle.title, "Status:", raffle.status)

    // Check if raffle is active
    if (raffle.status !== "active") {
      return NextResponse.json({ error: "Raffle is not active" }, { status: 400 })
    }

    // Check if user already entered
    const { data: existingEntry } = await supabase
      .from("raffle_entries")
      .select("id")
      .eq("raffle_id", raffleId)
      .eq("user_id", userData.id)
      .single()

    if (existingEntry) {
      console.log("[v0] User already entered this raffle")
      return NextResponse.json({ error: "You have already entered this raffle" }, { status: 400 })
    }

    const isFree = raffle.entry_type === "free" || raffle.ticket_price === 0

    if (!isFree && userData.points_balance < raffle.ticket_price) {
      console.log("[v0] Not enough points:", userData.points_balance, "<", raffle.ticket_price)
      return NextResponse.json({ error: "Not enough points" }, { status: 400 })
    }

    // Deduct points if not free
    if (!isFree) {
      const { error: deductError } = await supabase
        .from("users")
        .update({ points_balance: userData.points_balance - raffle.ticket_price })
        .eq("id", userData.id)

      if (deductError) {
        console.error("[v0] Error deducting points:", deductError)
        return NextResponse.json({ error: "Failed to deduct points" }, { status: 500 })
      }
      console.log("[v0] Points deducted successfully")
    }

    const { error: entryError } = await supabase.from("raffle_entries").insert({
      raffle_id: raffleId,
      user_id: userData.id,
      username: userData.username,
      tickets_purchased: 1,
      ticket_numbers: [], // Empty array for now
      points_spent: isFree ? 0 : raffle.ticket_price,
    })

    if (entryError) {
      console.error("[v0] Error creating entry:", entryError)
      // Refund points if entry failed
      if (!isFree) {
        await supabase.from("users").update({ points_balance: userData.points_balance }).eq("id", userData.id)
      }
      return NextResponse.json({ error: "Failed to enter raffle" }, { status: 500 })
    }

    console.log("[v0] Raffle entry created successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error entering raffle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
