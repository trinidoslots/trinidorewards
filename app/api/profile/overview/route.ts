import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"

/**
 * Everything the profile's header, Overview and Stats tabs show, in one call.
 *
 * Counted from the tables that already record it — predictions, tournament
 * entries, raffle tickets, wins, redemptions — so nothing new is tracked. Each
 * query stands alone: a table that is missing or fails leaves its number at
 * zero rather than taking the page down.
 */

export const dynamic = "force-dynamic"

export type ActivityItem = {
  id: string
  kind: "redemption" | "raffle" | "prediction" | "tournament" | "win"
  title: string
  detail: string | null
  at: string
}

type Row = Record<string, unknown>

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? null : String(value))

export async function GET() {
  const cookieStore = await cookies()
  const userId = (await getSiteSession())?.userId
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let client: ReturnType<typeof serviceClient>
  try {
    client = serviceClient()
  } catch {
    return NextResponse.json({ error: "Not configured" }, { status: 503 })
  }

  const { data: user } = await client.from("users").select("*").eq("id", userId).maybeSingle()
  if (!user) return NextResponse.json({ error: "No such user" }, { status: 404 })

  const points = Number(user.points_balance) || 0
  const username = typeof user.username === "string" ? user.username : ""

  const settle = async <T,>(query: PromiseLike<{ data: T | null; count?: number | null; error: unknown }>) => {
    try {
      const result = await query
      if (result.error) console.error("[profile] partial:", result.error)
      return result
    } catch (error) {
      console.error("[profile] partial:", error)
      return { data: null, count: 0, error }
    }
  }

  const [ahead, predictions, tournaments, raffles, wins, redemptions] = await Promise.all([
    // Rank on points: everyone with more, plus one.
    settle(client.from("users").select("id", { count: "exact", head: true }).gt("points_balance", points)),
    settle(
      client
        .from("hunt_predictions")
        .select("id, predicted_end_balance, created_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ),
    settle(
      client
        .from("tournament_entries")
        .select("id, slot_name, created_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ),
    settle(
      client
        .from("raffle_entries")
        .select("id, raffle_id, tickets_purchased, points_spent, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ),
    settle(
      username
        ? client
            .from("win_logs")
            .select("id, source, prize, amount, created_at", { count: "exact" })
            .or(`user_id.eq.${userId},username.ilike.${username}`)
            .order("created_at", { ascending: false })
            .limit(10)
        : client
            .from("win_logs")
            .select("id, source, prize, amount, created_at", { count: "exact" })
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),
    ),
    settle(
      client
        .from("redemptions")
        .select("id, item_name, cost, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ),
  ])

  const raffleRows = (raffles.data ?? []) as Row[]
  const redemptionRows = (redemptions.data ?? []) as Row[]

  // Raffle rows carry the points but not the prize.
  const raffleIds = Array.from(new Set(raffleRows.map((row) => text(row.raffle_id)).filter(Boolean))) as string[]
  const titles = new Map<string, string>()
  if (raffleIds.length) {
    const { data } = await settle(client.from("raffles").select("id, title").in("id", raffleIds))
    for (const raffle of (data ?? []) as Row[]) titles.set(String(raffle.id), String(raffle.title ?? "Raffle"))
  }

  const spentOnStore = redemptionRows
    // Cancelled redemptions were refunded.
    .filter((row) => row.status !== "cancelled" && row.status !== "rejected")
    .reduce((sum, row) => sum + (Number(row.cost) || 0), 0)
  const spentOnRaffles = raffleRows.reduce((sum, row) => sum + (Number(row.points_spent) || 0), 0)
  const tickets = raffleRows.reduce((sum, row) => sum + (Number(row.tickets_purchased) || 0), 0)

  const activity: ActivityItem[] = [
    ...redemptionRows.slice(0, 10).map((row) => ({
      id: `redemption-${row.id}`,
      kind: "redemption" as const,
      title: `Redeemed ${text(row.item_name) ?? "an item"}`,
      detail: `${Math.round(Number(row.cost) || 0).toLocaleString("en-US")} points · ${text(row.status) ?? ""}`,
      at: String(row.created_at),
    })),
    ...raffleRows.slice(0, 10).map((row) => ({
      id: `raffle-${row.id}`,
      kind: "raffle" as const,
      title: `Entered ${titles.get(String(row.raffle_id)) ?? "a raffle"}`,
      detail: `${Number(row.tickets_purchased) || 0} tickets`,
      at: String(row.created_at),
    })),
    ...((predictions.data ?? []) as Row[]).map((row) => ({
      id: `prediction-${row.id}`,
      kind: "prediction" as const,
      title: "Predicted a hunt",
      detail: row.predicted_end_balance != null ? `$${Math.round(Number(row.predicted_end_balance)).toLocaleString("en-US")}` : null,
      at: String(row.created_at),
    })),
    ...((tournaments.data ?? []) as Row[]).map((row) => ({
      id: `tournament-${row.id}`,
      kind: "tournament" as const,
      title: "Joined a tournament",
      detail: text(row.slot_name),
      at: String(row.created_at),
    })),
    ...((wins.data ?? []) as Row[]).map((row) => ({
      id: `win-${row.id}`,
      kind: "win" as const,
      title: `Won ${text(row.prize) ?? text(row.source) ?? "a prize"}`,
      detail: row.amount != null ? `$${Math.round(Number(row.amount)).toLocaleString("en-US")}` : null,
      at: String(row.created_at),
    })),
  ]
    .filter((item) => item.at && item.at !== "undefined")
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12)

  return NextResponse.json({
    user: {
      id: user.id,
      username,
      avatar_url: user.avatar_url ?? null,
      points_balance: points,
      created_at: user.created_at ?? null,
      last_seen: user.updated_at ?? null,
    },
    rank: (ahead.count ?? 0) + 1,
    counts: {
      predictions: predictions.count ?? (predictions.data as Row[] | null)?.length ?? 0,
      tournaments: tournaments.count ?? (tournaments.data as Row[] | null)?.length ?? 0,
      raffles: raffleRows.length,
      tickets,
      wins: wins.count ?? (wins.data as Row[] | null)?.length ?? 0,
      redemptions: redemptionRows.length,
    },
    spent: { store: spentOnStore, raffles: spentOnRaffles, total: spentOnStore + spentOnRaffles },
    activity,
    // The Redemptions tab reads these from here: the table is private (072).
    redemptions: redemptionRows,
  })
}
