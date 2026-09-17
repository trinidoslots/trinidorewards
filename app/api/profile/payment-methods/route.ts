import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"

/**
 * A user's own payout details.
 *
 * user_payment_methods has RLS on and no policy, so the browser cannot touch it
 * with the anon key at all — every read and write comes through here, scoped to
 * whoever the user_db_id cookie says is asking. That cookie is the same one the
 * rest of the site authenticates with (see /api/raffles/enter).
 */

const METHODS = ["paypal", "crypto", "bank", "skrill", "other"]

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("user_db_id")?.value ?? null
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await serviceClient()
    .from("user_payment_methods")
    .select("id, method, label, value, is_primary, created_at")
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
  const method = String(body?.method ?? "").trim().toLowerCase()
  const value = String(body?.value ?? "").trim()
  const label = String(body?.label ?? "").trim()

  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: "Unknown payment method" }, { status: 400 })
  }
  if (!value) return NextResponse.json({ error: "A value is required" }, { status: 400 })
  // Long enough for an IBAN or a wallet, short enough that the field cannot be
  // used as free storage.
  if (value.length > 200) return NextResponse.json({ error: "That value is too long" }, { status: 400 })

  const { data, error } = await serviceClient()
    .from("user_payment_methods")
    .insert({ user_id: userId, method, label: label || null, value })
    .select("id, method, label, value, is_primary, created_at")
    .single()

  if (error) {
    // The unique index is on (user_id, method, value) — the same account added
    // twice is a duplicate, not a second one.
    const duplicate = (error as { code?: string }).code === "23505"
    console.error("[v0] Could not add payment method:", error)
    return NextResponse.json(
      { error: duplicate ? "That payment method is already saved" : "Could not save that payment method" },
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
