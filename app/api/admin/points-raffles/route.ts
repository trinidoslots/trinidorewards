import { after } from "next/server"
import { requireAdmin, requireStaff } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { botPointsRaffleOpen } from "@/lib/kick-bot/announce"
import {
  MAX_RAFFLE_MINUTES,
  MAX_RAFFLE_POINTS,
  MAX_RAFFLE_WINNERS,
  drawExpiredPointsRaffles,
  drawPointsRaffle,
  type PointsRaffle,
} from "@/lib/points-raffle"

/**
 * Points raffles, for Kick Giveaway → Points Raffle.
 *
 * GET   — the open raffle with its entrants, and the last ones. Draws any whose
 *         time ran out first, so the page polling it ends a raffle on time even
 *         when chat is quiet.
 * POST  — { keyword, minutes, pointsEach, winners } starts one (admins).
 * PATCH — { id, action: "end" | "cancel" } draws now, or stops without paying.
 */

export const dynamic = "force-dynamic"

const COLUMNS =
  "id, keyword, points_each, winner_count, starts_at, ends_at, status, created_by, drawn_at, entry_count, eligible_count, winners, created_at"

function whole(value: unknown, min: number, max: number): number | null {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

export async function GET() {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response

  try {
    await drawExpiredPointsRaffles()
  } catch (problem) {
    console.error("[points-raffles] draw on read:", problem)
  }

  const client = serviceClient()
  const { data: raffles, error } = await client
    .from("points_raffles")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(15)
  if (error) {
    return Response.json({ error: `${error.message} – run scripts/089_points_raffles.sql` }, { status: 500 })
  }

  const open = (raffles ?? []).find((raffle) => raffle.status === "open") ?? null
  let entries: { username: string; kick_id: string; entered_at: string; hasAccount: boolean }[] = []
  let entryCount = 0

  if (open) {
    const [{ data: rows }, { count }] = await Promise.all([
      client
        .from("points_raffle_entries")
        .select("username, kick_id, entered_at")
        .eq("raffle_id", open.id)
        .order("entered_at", { ascending: false })
        .limit(200),
      client.from("points_raffle_entries").select("kick_id", { count: "exact", head: true }).eq("raffle_id", open.id),
    ])
    entryCount = count ?? 0
    const ids = (rows ?? []).map((row) => row.kick_id)
    const { data: accounts } = ids.length
      ? await client.from("users").select("kick_id").in("kick_id", ids)
      : { data: [] as { kick_id: string }[] }
    const known = new Set((accounts ?? []).map((account) => String(account.kick_id)))
    entries = (rows ?? []).map((row) => ({ ...row, hasAccount: known.has(String(row.kick_id)) }))
  }

  return Response.json({
    open,
    entries,
    entryCount,
    history: (raffles ?? []).filter((raffle) => raffle.status !== "open").slice(0, 10),
    limits: { minutes: MAX_RAFFLE_MINUTES, winners: MAX_RAFFLE_WINNERS, points: MAX_RAFFLE_POINTS },
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : ""
  const minutes = whole(body.minutes, 1, MAX_RAFFLE_MINUTES)
  const pointsEach = whole(body.pointsEach, 1, MAX_RAFFLE_POINTS)
  const winners = whole(body.winners, 1, MAX_RAFFLE_WINNERS)

  if (!keyword || keyword.length > 100) return Response.json({ error: "Enter a keyword (up to 100 characters)." }, { status: 400 })
  if (minutes === null) return Response.json({ error: `Duration must be 1–${MAX_RAFFLE_MINUTES} minutes.` }, { status: 400 })
  if (pointsEach === null) return Response.json({ error: `Points must be 1–${MAX_RAFFLE_POINTS.toLocaleString("en-US")}.` }, { status: 400 })
  if (winners === null) return Response.json({ error: `Winners must be 1–${MAX_RAFFLE_WINNERS}.` }, { status: 400 })

  // A raffle whose time is up but nobody has drawn yet would block the new one.
  await drawExpiredPointsRaffles().catch((problem) => console.error("[points-raffles] draw before start:", problem))

  const now = new Date()
  const { data, error } = await serviceClient()
    .from("points_raffles")
    .insert({
      keyword,
      points_each: pointsEach,
      winner_count: winners,
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + minutes * 60_000).toISOString(),
      created_by: auth.email,
    })
    .select(COLUMNS)
    .single()

  if (error) {
    if (error.code === "23505") return Response.json({ error: "A points raffle is already running. End it first." }, { status: 409 })
    console.error("[points-raffles] create:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const raffle = data as PointsRaffle
  after(() => botPointsRaffleOpen(raffle.id))
  return Response.json({ raffle })
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = typeof body.id === "string" ? body.id : ""
  if (!id) return Response.json({ error: "id is required" }, { status: 400 })

  try {
    if (body.action === "end") {
      const raffle = await drawPointsRaffle(id, true)
      if (!raffle) return Response.json({ error: "Raffle not found." }, { status: 404 })
      return Response.json({ raffle })
    }
    if (body.action === "cancel") {
      const { data, error } = await serviceClient()
        .from("points_raffles")
        .update({ status: "cancelled", drawn_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "open")
        .select(COLUMNS)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return Response.json({ error: "That raffle is not running any more." }, { status: 409 })
      return Response.json({ raffle: data })
    }
    return Response.json({ error: "Unknown action" }, { status: 400 })
  } catch (problem) {
    console.error("[points-raffles]", body.action, problem)
    return Response.json({ error: problem instanceof Error ? problem.message : "Failed" }, { status: 500 })
  }
}
