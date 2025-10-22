import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { raffleId } = await request.json()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("username, points")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get raffle data
    const { data: raffle, error: raffleError } = await supabase.from("raffles").select("*").eq("id", raffleId).single()

    if (raffleError || !raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 })
    }

    // Check if raffle is active
    if (raffle.status !== "active") {
      return NextResponse.json({ error: "Raffle is not active" }, { status: 400 })
    }

    // Check if user already entered
    const { data: existingEntry } = await supabase
      .from("raffle_entries")
      .select("id")
      .eq("raffle_id", raffleId)
      .eq("user_id", user.id)
      .single()

    if (existingEntry) {
      return NextResponse.json({ error: "You have already entered this raffle" }, { status: 400 })
    }

    // Check if user has enough points (if not free)
    const isFree = raffle.entry_type === "free" || raffle.ticket_price === 0
    if (!isFree && userData.points < raffle.ticket_price) {
      return NextResponse.json({ error: "Not enough points" }, { status: 400 })
    }

    // Deduct points if not free
    if (!isFree) {
      const { error: deductError } = await supabase
        .from("users")
        .update({ points: userData.points - raffle.ticket_price })
        .eq("id", user.id)

      if (deductError) {
        console.error("[v0] Error deducting points:", deductError)
        return NextResponse.json({ error: "Failed to deduct points" }, { status: 500 })
      }
    }

    // Create entry
    const { error: entryError } = await supabase.from("raffle_entries").insert({
      raffle_id: raffleId,
      user_id: user.id,
      username: userData.username,
      tickets_purchased: 1,
    })

    if (entryError) {
      console.error("[v0] Error creating entry:", entryError)
      // Refund points if entry failed
      if (!isFree) {
        await supabase.from("users").update({ points: userData.points }).eq("id", user.id)
      }
      return NextResponse.json({ error: "Failed to enter raffle" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error entering raffle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
