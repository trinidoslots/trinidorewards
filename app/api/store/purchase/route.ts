import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const kickUserId = cookieStore.get("kick_user_id")
    const kickUsername = cookieStore.get("kick_username")

    if (!kickUserId || !kickUsername) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { itemId } = await request.json()

    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, points_balance")
      .eq("kick_id", kickUserId.value)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get item data
    const { data: item, error: itemError } = await supabase.from("store_items").select("*").eq("id", itemId).single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    // Check if item is available
    if (!item.is_available) {
      return NextResponse.json({ error: "Item not available" }, { status: 400 })
    }

    // Check if item is in stock
    if (item.quantity <= 0) {
      return NextResponse.json({ error: "Item out of stock" }, { status: 400 })
    }

    // Check if user has enough points
    if (user.points_balance < item.cost) {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 })
    }

    // Deduct points from user
    const { error: updateError } = await supabase
      .from("users")
      .update({ points_balance: user.points_balance - item.cost })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json({ error: "Failed to update points" }, { status: 500 })
    }

    // Decrease item quantity
    const { error: itemUpdateError } = await supabase
      .from("store_items")
      .update({ quantity: item.quantity - 1 })
      .eq("id", itemId)

    if (itemUpdateError) {
      // Rollback points if item update fails
      await supabase.from("users").update({ points_balance: user.points_balance }).eq("id", user.id)
      return NextResponse.json({ error: "Failed to update item stock" }, { status: 500 })
    }

    // Create redemption record
    const { error: redemptionError } = await supabase.from("redemptions").insert({
      user_id: user.id,
      item_id: itemId,
      item_name: item.name,
      cost: item.cost,
      status: "pending",
    })

    if (redemptionError) {
      console.error("[v0] Failed to create redemption:", redemptionError)
    }

    return NextResponse.json({
      success: true,
      newBalance: user.points_balance - item.cost,
      message: "Purchase successful!",
    })
  } catch (error) {
    console.error("[v0] Purchase error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
