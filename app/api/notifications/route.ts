import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"

/**
 * The signed-in user's notifications for the bell in the top bar.
 *
 * Worked out from what already happened rather than stored: a raffle they
 * won, a redemption they submitted, a redemption that was confirmed. There is
 * no notifications table to keep in step, and nothing to backfill: everything
 * a user did before this existed shows up too.
 *
 * Read or unread is stored on the account (scripts/086): "Mark all as read"
 * keeps a moment, single reads keep their ids. POST changes it; opening the
 * bell does not.
 */

export const dynamic = "force-dynamic"

export type SiteNotification = {
  id: string
  kind: "raffle_won" | "redemption_submitted" | "redemption_confirmed"
  title: string
  body: string
  at: string
  href: string
  read: boolean
}

const LIMIT = 20
/** Single reads kept after the last "Mark all as read"; the oldest drop off. */
const MAX_READ_IDS = 100

type ReadState = { before: number; ids: Set<string>; stored: boolean }

/** What the user has read. Before scripts/086 the columns are missing and nothing is stored. */
function readState(user: Record<string, unknown> | null): ReadState {
  if (!user || !("notifications_read_ids" in user)) return { before: 0, ids: new Set(), stored: false }
  const before = user.notifications_read_before ? Date.parse(String(user.notifications_read_before)) : 0
  const ids = Array.isArray(user.notifications_read_ids) ? (user.notifications_read_ids as string[]) : []
  return { before: Number.isFinite(before) ? before : 0, ids: new Set(ids), stored: true }
}

export async function GET() {
  const cookieStore = await cookies()
  const userId = (await getSiteSession())?.userId
  if (!userId) return NextResponse.json({ notifications: [] })

  let client: ReturnType<typeof serviceClient>
  try {
    client = serviceClient()
  } catch {
    return NextResponse.json({ notifications: [] })
  }

  // "*" so a database without scripts/086 still answers, just without read state.
  const { data: user } = await client.from("users").select("*").eq("id", userId).maybeSingle()
  const reads = readState(user as Record<string, unknown> | null)
  const username = typeof user?.username === "string" ? user.username.trim() : ""

  const [raffles, redemptions] = await Promise.all([
    username
      ? client
          .from("raffles")
          .select("id, title, prize_name, draw_date, updated_at, winner_username")
          // ILIKE treats _ as a wildcard, and Kick names are full of them, so
          // this only narrows; the exact match is made below.
          .ilike("winner_username", username)
          .order("updated_at", { ascending: false })
          .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),
    // "*": the table predates the migrations here, and naming a column it
    // might not have (updated_at) would fail the whole request.
    client.from("redemptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(LIMIT),
  ])

  if (raffles.error) console.error("[notifications] raffles:", raffles.error)
  if (redemptions.error) console.error("[notifications] redemptions:", redemptions.error)

  const items: SiteNotification[] = []
  const lowered = username.toLowerCase()

  for (const raffle of raffles.data ?? []) {
    if (String(raffle.winner_username ?? "").trim().toLowerCase() !== lowered) continue
    items.push({
      id: `raffle-${raffle.id}`,
      kind: "raffle_won",
      title: "You won a raffle",
      body: raffle.prize_name || raffle.title || "Raffle prize",
      at: raffle.draw_date ?? raffle.updated_at,
      href: "/raffles",
      read: false,
    })
  }

  for (const redemption of (redemptions.data ?? []) as Record<string, unknown>[]) {
    const name = String(redemption.item_name ?? "Store item")
    const created = String(redemption.created_at ?? "")
    items.push({
      id: `redemption-${redemption.id}-submitted`,
      kind: "redemption_submitted",
      title: "Redemption submitted",
      body: name,
      at: created,
      href: "/profile?tab=redemptions",
      read: false,
    })
    if (redemption.status === "completed") {
      items.push({
        id: `redemption-${redemption.id}-confirmed`,
        kind: "redemption_confirmed",
        title: "Redemption confirmed",
        body: name,
        at: String(redemption.updated_at ?? created),
        href: "/profile?tab=redemptions",
        read: false,
      })
    }
  }

  items.sort((a, b) => Date.parse(b.at || "0") - Date.parse(a.at || "0"))
  const notifications = items
    .filter((item) => item.at)
    .slice(0, LIMIT)
    .map((item) => ({ ...item, read: Date.parse(item.at) <= reads.before || reads.ids.has(item.id) }))
  return NextResponse.json({ notifications, stored: reads.stored })
}

/**
 * Marks notifications read: { action: "read", id } for one, { action:
 * "read_all" } for everything up to now.
 */
export async function POST(request: Request) {
  const userId = (await getSiteSession())?.userId
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { action?: unknown; id?: unknown } | null
  const client = serviceClient()

  if (body?.action === "read_all") {
    const { error } = await client
      .from("users")
      .update({ notifications_read_before: new Date().toISOString(), notifications_read_ids: [] })
      .eq("id", userId)
    if (error) return NextResponse.json({ error: "Could not save. Has scripts/086 been run?" }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body?.action === "read" && typeof body.id === "string" && body.id.length <= 120) {
    const { data: user, error: loadError } = await client.from("users").select("*").eq("id", userId).maybeSingle()
    if (loadError || !user) return NextResponse.json({ error: "Could not load your account." }, { status: 500 })
    const reads = readState(user as Record<string, unknown>)
    if (!reads.stored) return NextResponse.json({ error: "Could not save. Has scripts/086 been run?" }, { status: 500 })
    if (!reads.ids.has(body.id)) {
      const ids = [...reads.ids, body.id].slice(-MAX_READ_IDS)
      const { error } = await client.from("users").update({ notifications_read_ids: ids }).eq("id", userId)
      if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Expected { action: "read", id } or { action: "read_all" }' }, { status: 400 })
}
