import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"

/**
 * Everything the admin user page shows, in one request.
 *
 * Behind a session check rather than open like some of the older admin routes:
 * this returns payout details, and the middleware only guards /admin *pages* —
 * an API route is reachable directly, so it has to establish for itself that
 * the caller is signed in.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient()
  const {
    data: { user: admin },
  } = await supabase.auth.getUser()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const client = serviceClient()

  const { data: user, error } = await client
    .from("users")
    .select("id, username, kick_id, avatar_url, points_balance, created_at")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[v0] Could not load user:", error)
    return NextResponse.json({ error: "Could not load that user" }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "No such user" }, { status: 404 })

  const [accounts, payments, redemptions, raffleEntries, wins] = await Promise.all([
    client
      .from("user_site_usernames")
      .select("id, site_name, username, created_at")
      .eq("user_id", id)
      .order("site_name"),
    client
      .from("user_payment_methods")
      .select("id, method, label, value, is_primary, created_at")
      .eq("user_id", id)
      .order("created_at"),
    client
      .from("redemptions")
      .select("id, item_id, item_name, cost, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("raffle_entries")
      .select("id, raffle_id, tickets_purchased, points_spent, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    // Matched on the name as well as the id: wins recorded before this account
    // existed were only ever attached to a username, and they are still theirs.
    client
      .from("win_logs")
      .select("id, username, source, source_ref, prize, amount, points, status, created_at")
      .or(`user_id.eq.${id},username.ilike.${user.username}`)
      .order("created_at", { ascending: false }),
  ])

  // Raffle rows carry the points but not the prize, so the titles are fetched
  // in one go rather than per entry.
  const raffleIds = Array.from(new Set((raffleEntries.data ?? []).map((entry) => entry.raffle_id).filter(Boolean)))
  const { data: raffles } = raffleIds.length
    ? await client.from("raffles").select("id, title, prize_name, status").in("id", raffleIds)
    : { data: [] as { id: string; title: string; prize_name: string; status: string }[] }

  const raffleById = new Map((raffles ?? []).map((raffle) => [raffle.id, raffle]))

  for (const result of [accounts, payments, redemptions, raffleEntries, wins]) {
    // A missing optional table should not take the whole page down — the
    // section simply renders empty.
    if (result.error) console.error("[v0] Partial user load:", result.error)
  }

  const redemptionRows = redemptions.data ?? []
  const raffleRows = (raffleEntries.data ?? []).map((entry) => ({
    ...entry,
    raffle: raffleById.get(entry.raffle_id) ?? null,
  }))

  const spentOnStore = redemptionRows
    // A rejected redemption was refunded, so counting it would overstate what
    // the user actually spent.
    .filter((row) => row.status !== "rejected" && row.status !== "cancelled")
    .reduce((sum, row) => sum + (Number(row.cost) || 0), 0)
  const spentOnRaffles = raffleRows.reduce((sum, row) => sum + (Number(row.points_spent) || 0), 0)

  return NextResponse.json({
    user,
    accounts: accounts.data ?? [],
    payments: payments.data ?? [],
    redemptions: redemptionRows,
    raffleEntries: raffleRows,
    wins: wins.data ?? [],
    totals: {
      points: Number(user.points_balance) || 0,
      spentOnStore,
      spentOnRaffles,
      spentTotal: spentOnStore + spentOnRaffles,
      redemptions: redemptionRows.length,
      rafflesEntered: raffleRows.length,
      tickets: raffleRows.reduce((sum, row) => sum + (Number(row.tickets_purchased) || 0), 0),
      wins: (wins.data ?? []).length,
      wonCash: (wins.data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    },
  })
}
