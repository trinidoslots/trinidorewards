import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { serviceClient } from "@/lib/supabase/service"
import { inStock, isAvailable, isUnlimited } from "@/lib/store"
import { readPayoutDetails, readPayoutMethod } from "@/lib/payout"
import { getSiteSession } from "@/lib/site-session"

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
    const userId = (await getSiteSession())?.userId
    const kickUserId = (await getSiteSession())?.kickId
    if (!userId && !kickUserId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { itemId, payout } = await request.json().catch(() => ({ itemId: null, payout: null }))
    if (!itemId) return NextResponse.json({ error: "Item ID required" }, { status: 400 })

    const client = serviceClient()

    // "*" rather than naming is_code_user: before scripts/076 the column does
    // not exist, and naming it would fail every purchase.
    const { data: user } = userId
      ? await client.from("users").select("*").eq("id", userId).maybeSingle()
      : await client.from("users").select("*").eq("kick_id", kickUserId!).maybeSingle()

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const { data: item } = await client.from("store_items").select("*").eq("id", itemId).maybeSingle()
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    if (!isAvailable(item)) return NextResponse.json({ error: "That item is not available" }, { status: 400 })
    if (!inStock(item)) return NextResponse.json({ error: "That item is out of stock" }, { status: 400 })
    if (item.code_user_only === true && user.is_code_user !== true) {
      return NextResponse.json({ error: "This item is for Code Users only" }, { status: 403 })
    }

    // Checked before any points move. The dialog asks for these, but the dialog
    // is client-side and this route is reachable without it — a redemption with
    // no payout details is one nobody can action, and the buyer would have paid
    // for it.
    const method = readPayoutMethod(item.payout_method)
    const parsed = readPayoutDetails(method, payout)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const cost = Number(item.cost) || 0
    const balance = Number(user.points_balance) || 0
    if (balance < cost) {
      return NextResponse.json({ error: `You need ${cost - balance} more points` }, { status: 400 })
    }

    // The unit is taken before any points move, guarded on the count just read.
    // It used to be decremented last, unguarded: two buyers of the last one
    // both passed the stock check and both got it. Now the second one's update
    // matches no row and they are told it sold out, having paid nothing.
    const limited = !isUnlimited(item.quantity)
    if (limited) {
      const { data: taken, error: stockError } = await client
        .from("store_items")
        .update({ quantity: Number(item.quantity) - 1 })
        .eq("id", itemId)
        .eq("quantity", item.quantity)
        .select("id")
      if (stockError || !taken || taken.length === 0) {
        if (stockError) console.error("[store] Could not reserve stock:", stockError)
        return NextResponse.json({ error: "That item just sold out or changed — try again" }, { status: 409 })
      }
    }

    // Puts the unit back when the purchase does not go through.
    const releaseStock = async () => {
      if (!limited) return
      const { data: fresh } = await client.from("store_items").select("quantity").eq("id", itemId).maybeSingle()
      const quantity = Number(fresh?.quantity)
      if (Number.isFinite(quantity) && !isUnlimited(quantity)) {
        await client.from("store_items").update({ quantity: quantity + 1 }).eq("id", itemId)
      }
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
      await releaseStock()
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
    const { data: redemption, error: redemptionError } = await client
      .from("redemptions")
      .insert({
        user_id: user.id,
        item_id: itemId,
        item_name: item.name,
        cost,
        status: "pending",
      })
      .select("id")
      .single()

    if (redemptionError || !redemption) {
      console.error("[v0] Could not create redemption:", redemptionError)
      await refund()
      await releaseStock()
      return NextResponse.json({ error: "Could not complete that purchase" }, { status: 500 })
    }

    // Where it gets sent, in its own table — see scripts/057 for why it is not
    // a column on redemptions.
    if (parsed.details) {
      const { error: payoutError } = await client.from("redemption_payouts").insert({
        redemption_id: redemption.id,
        method: parsed.details.method,
        username: parsed.details.method === "onsite_tip" ? parsed.details.username : null,
        crypto: parsed.details.method === "crypto" ? parsed.details.crypto : null,
        chain: parsed.details.method === "crypto" ? parsed.details.chain : null,
        address: parsed.details.method === "crypto" ? parsed.details.address : null,
      })

      if (payoutError) {
        // Unlike the stock count below, this one is fatal. A paid-for
        // redemption with no address is one the admin cannot pay out, so the
        // purchase is undone rather than left for someone to puzzle over.
        console.error("[v0] Could not store payout details:", payoutError)
        await client.from("redemptions").delete().eq("id", redemption.id)
        await refund()
        await releaseStock()
        return NextResponse.json({ error: "Could not save your payout details — nothing was charged" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, newBalance: balance - cost, message: "Purchase successful" })
  } catch (error) {
    console.error("[v0] Purchase error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
