import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import type { PayoutDetails } from "@/lib/payout"

/** One wallet the buyer has saved on their profile. */
export type SavedWallet = { crypto: string | null; chain: string | null; address: string }

/**
 * Where each redemption should be paid out to, and what the buyer has on file.
 *
 * Its own route, and the only way to read either table: both redemption_payouts
 * (057) and user_payment_methods (045) have RLS on and no policy, because a
 * wallet address must not be readable with the public anon key the way the
 * redemptions list itself is.
 *
 * The saved wallets are here so paying someone out does not mean opening their
 * profile in another tab. They also give the address typed at checkout
 * something to be checked against: one that matches a wallet the account has
 * held for a while is a different proposition from one that appeared at the
 * moment of purchase.
 *
 * Both are maps — by redemption id and by user id — so the existing list can
 * keep its own query and look each row up.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = serviceClient()

  const [{ data, error }, saved] = await Promise.all([
    supabase.from("redemption_payouts").select("redemption_id, method, username, crypto, chain, address"),
    supabase
      .from("user_payment_methods")
      .select("user_id, crypto, chain, label, value")
      .eq("method", "crypto"),
  ])

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

  const wallets: Record<string, SavedWallet[]> = {}

  // A failure here is not worth losing the payout details over — the list still
  // shows what to pay, just without the cross-check.
  if (saved.error) {
    console.error("[v0] Could not load saved wallets:", saved.error.message)
  } else {
    for (const row of saved.data ?? []) {
      const entry = row as { user_id: string; crypto: string | null; chain: string | null; label: string | null; value: string }
      if (!entry.value) continue
      wallets[entry.user_id] = [
        ...(wallets[entry.user_id] ?? []),
        // crypto arrives with 064; before that the coin was free text in label.
        { crypto: entry.crypto ?? entry.label, chain: entry.chain, address: entry.value },
      ]
    }
  }

  return NextResponse.json({ payouts, wallets })
}
