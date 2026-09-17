import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { serviceClient } from "@/lib/supabase/service"
import { inStock, isAvailable, isUnlimited } from "@/lib/store"

/**
 * Buying an item with points.
 *
 * Rewritten around two bugs that both let the wrong thing happen:
 *
 *   `if (!item.is_available)` — is_available is a text column, so "false" is a
 *   non-empty string and passed the check. Disabled items were purchasable.
 *
 *   `if (item.quantity <= 0)` — the admin form documents -1 as unlimited, so
 *   every unlimited item read as out of stock and could never be bought.
 *
 * Also moved onto the service role: the anon client it used is subject to RLS
 * on users, which made taking the points a matter of whatever policies happen
 * to exist.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("user_db_id")?.value
    const kickUserId = cookieStore.get("kick_user_id")?.value
    if (!userId && !kickUserId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { itemId } = await request.json().catch(() => ({ itemId: null }))
    if (!itemId) return NextResponse.json({ error: "Item ID required" }, { status: 400 })

    const client = serviceClient()

    const { data: user } = userId
      ? await client.from("users").select("id, points_balance").eq("id", userId).maybeSingle()
      : await client.from("users").select("id, points_balance").eq("kick_id", kickUserId!).maybeSingle()

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const { data: item } = await client.from("store_items").select("*").eq("id", itemId).maybeSingle()
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    if (!isAvailable(item)) return NextResponse.json({ error: "That item is not available" }, { status: 400 })
    if (!inStock(item)) return NextResponse.json({ error: "That item is out of stock" }, { status: 400 })

    const cost = Number(item.cost) || 0
    const balance = Number(user.points_balance) || 0
    if (balance < cost) {
      return NextResponse.json({ error: `You need ${cost - balance} more points` }, { status: 400 })
    }

    // Guarded on the balance just read: a concurrent change makes this match no
    // rows, and we stop rather than writing a stale figure over it.
    const { data: deducted, error: deductError } = await client
      .from("users")
      .update({ points_balance: balance - cost })
      .eq("id", user.id)
      .eq("points_balance", balance)
      .select("id")

    if (deductError || !deducted || deducted.length === 0) {
      console.error("[v0] Could not deduct points:", deductError)
      return NextResponse.json({ error: "Your balance changed — try again" }, { status: 409 })
    }

    const refund = async () => {
      const { data: fresh } = await client.from("users").select("points_balance").eq("id", user.id).maybeSingle()
      await client
        .from("users")
        .update({ points_balance: (Number(fresh?.points_balance) || 0) + cost })
        .eq("id", user.id)
    }

    // The record of the purchase matters more than the stock count, so it is
    // written first: a failure here has to undo the charge, and losing the
    // redemption while keeping the points would be the worst outcome.
    const { error: redemptionError } = await client.from("redemptions").insert({
      user_id: user.id,
      item_id: itemId,
      item_name: item.name,
      cost,
      status: "pending",
    })

    if (redemptionError) {
      console.error("[v0] Could not create redemption:", redemptionError)
      await refund()
      return NextResponse.json({ error: "Could not complete that purchase" }, { status: 500 })
    }

    if (!isUnlimited(item.quantity)) {
      const { error: stockError } = await client
        .from("store_items")
        .update({ quantity: Number(item.quantity) - 1 })
        .eq("id", itemId)
      // Not fatal: the purchase is recorded and paid for. A stock count that is
      // one too high is an admin correction, not a reason to fail the buyer.
      if (stockError) console.error("[v0] Could not decrement stock:", stockError)
    }

    return NextResponse.json({ success: true, newBalance: balance - cost, message: "Purchase successful" })
  } catch (error) {
    console.error("[v0] Purchase error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
