import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { findChain, findCrypto } from "@/lib/payout"
import { getSiteSession } from "@/lib/site-session"

/**
 * A user's own payout details.
 *
 * user_payment_methods has RLS on and no policy, so the browser cannot touch it
 * with the anon key at all — every read and write comes through here, scoped to
 * whoever the user_db_id cookie says is asking. That cookie is the same one the
 * rest of the site authenticates with (see /api/raffles/enter).
 *
 * Crypto only. PayPal, bank, Skrill and "other" used to be offered and none of
 * them are ever paid out, so they were four ways to store a detail nobody acts
 * on. Rows already saved under them are left alone — this only refuses new ones.
 *
 * Coin and chain are validated against CRYPTOS in lib/payout.ts, the same list
 * the store's buy dialog offers, so a wallet saved here is one the checkout can
 * actually use.
 */

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return (await getSiteSession())?.userId ?? null
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await serviceClient()
    .from("user_payment_methods")
    .select("id, method, label, crypto, chain, value, is_primary, created_at")
    .eq("user_id", userId)
    .order("created_at")

  if (error) {
    console.error("[v0] Could not load payment methods:", error)
    return NextResponse.json({ error: "Could not load payment methods" }, { status: 500 })
  }
  return NextResponse.json({ methods: data ?? [] })
}

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const value = String(body?.value ?? "").trim()

  const coin = findCrypto(body?.crypto)
  if (!coin) return NextResponse.json({ error: "Pick a coin" }, { status: 400 })

  // A single-network coin may arrive without one; a multi-network coin may not,
  // because guessing is how funds end up on the wrong chain.
  const chain = findChain(coin.code, body?.chain) ?? (coin.chains.length === 1 ? coin.chains[0] : null)
  if (!chain) return NextResponse.json({ error: "Pick a network" }, { status: 400 })

  if (!value) return NextResponse.json({ error: "An address is required" }, { status: 400 })
  // Long enough for any wallet, short enough that the field cannot be used as
  // free storage.
  if (value.length > 200) return NextResponse.json({ error: "That address is too long" }, { status: 400 })

  const { data, error } = await serviceClient()
    .from("user_payment_methods")
    .insert({
      user_id: userId,
      method: "crypto",
      crypto: coin.code,
      chain: chain.id,
      // Kept in step with the coin, so anything still reading the old free-text
      // label agrees with the columns.
      label: coin.code,
      value,
    })
    .select("id, method, label, crypto, chain, value, is_primary, created_at")
    .single()

  if (error) {
    // The unique index is on (user_id, method, value) — the same account added
    // twice is a duplicate, not a second one.
    const duplicate = (error as { code?: string }).code === "23505"
    // crypto and chain arrive with scripts/064. Before it has run the columns
    // are absent and PostgREST rejects the whole insert rather than the two
    // unknown fields, so saving anything at all would fail.
    const columnMissing = (error as { code?: string }).code === "PGRST204" || (error as { code?: string }).code === "42703"

    if (columnMissing) {
      const retry = await serviceClient()
        .from("user_payment_methods")
        .insert({ user_id: userId, method: "crypto", label: coin.code, value })
        .select("id, method, label, value, is_primary, created_at")
        .single()

      if (!retry.error) {
        return NextResponse.json({
          method: retry.data,
          warning: "Saved without the network — run scripts/064 in Supabase.",
        })
      }
    }

    console.error("[v0] Could not add payment method:", error)
    return NextResponse.json(
      { error: duplicate ? "That address is already saved for that network" : "Could not save that address" },
      { status: duplicate ? 409 : 500 },
    )
  }
  return NextResponse.json({ method: data })
}

export async function DELETE(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  // Scoped by user_id as well as id: without it, any signed-in user could
  // delete anyone's row by guessing a uuid.
  const { error } = await serviceClient()
    .from("user_payment_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    console.error("[v0] Could not delete payment method:", error)
    return NextResponse.json({ error: "Could not delete that payment method" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
