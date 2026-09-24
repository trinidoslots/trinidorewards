import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"

/**
 * The winner log.
 *
 * Behind a Supabase session check: the middleware only guards /admin pages, and
 * an API route is reachable on its own.
 */

const COLUMNS =
  "id, user_id, username, source, source_ref, prize, amount, points, note, status, created_at, paid_at"

const SOURCES = ["giveaway", "prediction", "tournament", "raffle", "manual"]

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { data, error } = await serviceClient()
    .from("win_logs")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    console.error("[v0] Could not load win logs:", error)
    return NextResponse.json({ error: "Could not load the winner log" }, { status: 500 })
  }
  return NextResponse.json({ wins: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const username = String(body?.username ?? "").trim()
  const prize = String(body?.prize ?? "").trim()
  const source = String(body?.source ?? "manual")

  if (!username) return NextResponse.json({ error: "A username is required" }, { status: 400 })
  if (!prize) return NextResponse.json({ error: "Say what they won" }, { status: 400 })
  if (!SOURCES.includes(source)) return NextResponse.json({ error: "Unknown source" }, { status: 400 })

  const client = serviceClient()

  // Match the account when one exists, but never block on it: giveaway winners
  // come out of Kick chat and may have no account here at all.
  let userId: string | null = body?.user_id ?? null
  if (!userId) {
    const { data: match } = await client.from("users").select("id").ilike("username", username).limit(1).maybeSingle()
    userId = match?.id ?? null
  }

  const toNumber = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null
  }

  const { data, error } = await client
    .from("win_logs")
    .insert({
      user_id: userId,
      username,
      source,
      source_ref: String(body?.source_ref ?? "").trim() || null,
      prize,
      amount: toNumber(body?.amount),
      points: toNumber(body?.points),
      note: String(body?.note ?? "").trim() || null,
      status: body?.status === "paid" ? "paid" : "pending",
      paid_at: body?.status === "paid" ? new Date().toISOString() : null,
    })
    .select(COLUMNS)
    .single()

  if (error) {
    console.error("[v0] Could not record win:", error)
    return NextResponse.json({ error: "Could not record that win" }, { status: 500 })
  }
  return NextResponse.json({ win: data })
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const id = String(body?.id ?? "")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const paid = body?.status === "paid"
  const { data, error } = await serviceClient()
    .from("win_logs")
    .update({ status: paid ? "paid" : "pending", paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id)
    .select(COLUMNS)
    .single()

  if (error) {
    console.error("[v0] Could not update win:", error)
    return NextResponse.json({ error: "Could not update that win" }, { status: 500 })
  }
  return NextResponse.json({ win: data })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const { error } = await serviceClient().from("win_logs").delete().eq("id", id)
  if (error) {
    console.error("[v0] Could not delete win:", error)
    return NextResponse.json({ error: "Could not delete that win" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
