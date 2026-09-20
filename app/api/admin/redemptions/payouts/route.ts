import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import type { PayoutDetails } from "@/lib/payout"

/**
 * Where each redemption should be paid out to.
 *
 * Its own route, and the only way to read redemption_payouts: that table has
 * RLS on and no policy, because a wallet address must not be readable with the
 * public anon key the way the redemptions list itself is. See scripts/057.
 *
 * Returned as a map keyed by redemption id so the existing list can keep its
 * own query and simply look each row up.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { data, error } = await serviceClient()
    .from("redemption_payouts")
    .select("redemption_id, method, username, crypto, chain, address")

  if (error) {
    console.error("[v0] Could not load payout details:", error)
    return NextResponse.json({ error: "Could not load payout details" }, { status: 500 })
  }

  const payouts: Record<string, PayoutDetails> = {}

  for (const row of data ?? []) {
    if (row.method === "onsite_tip" && row.username) {
      payouts[row.redemption_id] = { method: "onsite_tip", username: row.username }
    } else if (row.method === "crypto" && row.crypto && row.chain && row.address) {
      payouts[row.redemption_id] = {
        method: "crypto",
        crypto: row.crypto,
        chain: row.chain,
        address: row.address,
      }
    }
  }

  return NextResponse.json({ payouts })
}
