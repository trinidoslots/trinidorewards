import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { totalsFor, type Transaction } from "@/lib/transactions"
import type { DashboardPayload } from "@/lib/admin-dashboard"

/**
 * Everything the admin overview shows, in one request.
 *
 * The overview used to read the database straight from the browser with the
 * public anon key. That worked because those tables are readable by anyone
 * holding that key, which is the thing we would rather not lean on — and it
 * meant a page of eight panels was eight round trips from the client, each
 * waiting on the last to finish rendering.
 *
 * It is one call behind the admin session now, and the counts are counted by
 * the database rather than by fetching the rows and measuring the array.
 *
 * Deliberately no SUMs. PostgREST caps a plain select at a thousand rows, so
 * adding up a column client-side is a figure that is right until the table
 * grows past the cap and then quietly wrong. Money comes from the settings row
 * the site already treats as canonical; everything else here is a count.
 */

export const dynamic = "force-dynamic"

/** Thirty days back, for the "new this month" figures. */
function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
}

type Client = ReturnType<typeof serviceClient>

/**
 * A row count, or 0.
 *
 * `head: true` asks PostgREST for the count and no rows at all, so this costs
 * a COUNT and nothing else. A missing table or a failed count returns 0 rather
 * than throwing: one panel of the overview being unavailable should not take
 * the whole page down with it, and a zero next to a label reads as "nothing
 * here" which is the truthful thing to say when we could not find out.
 */
async function countOf(
  client: Client,
  table: string,
  apply?: (query: ReturnType<Client["from"]>) => unknown,
): Promise<number> {
  let query: any = client.from(table).select("*", { count: "exact", head: true })
  if (apply) query = apply(query)
  const { count, error } = await query
  if (error) {
    console.error(`[v0] dashboard count failed for ${table}:`, error.message)
    return 0
  }
  return count ?? 0
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let client: Client
  try {
    client = serviceClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Supabase service role is not configured." },
      { status: 503 },
    )
  }

  const since = thirtyDaysAgo()
  const now = new Date().toISOString()

  // All of it at once. These do not depend on each other, and run in series
  // they would turn a page load into a dozen sequential round trips to the
  // database.
  const [
    usersTotal,
    usersRecent,
    redemptionsTotal,
    redemptionsPending,
    winsTotal,
    winsPending,
    rafflesToDraw,
    leaderboardsOverdue,
    modulesTotal,
    modulesDisabled,
    givenAwayRow,
    activeLeaderboards,
    hunt,
    ledger,
  ] = await Promise.all([
    countOf(client, "users"),
    countOf(client, "users", (q: any) => q.gte("created_at", since)),
    countOf(client, "redemptions"),
    countOf(client, "redemptions", (q: any) => q.eq("status", "pending")),
    countOf(client, "win_logs"),
    countOf(client, "win_logs", (q: any) => q.eq("status", "pending")),
    // Ended and nobody drawn yet. `status` alone is not enough: a raffle whose
    // end date has passed is over whether or not anything has moved it off
    // "active", and that is exactly the one that needs attention.
    countOf(client, "raffles", (q: any) => q.lt("end_date", now).is("winner_username", null)),
    // Still marked active after its end date.
    countOf(client, "leaderboards", (q: any) => q.eq("status", "active").lt("end_date", now)),
    countOf(client, "modules"),
    countOf(client, "modules", (q: any) => q.eq("is_enabled", false)),
    client.from("settings").select("value").eq("key", "total_given_away").maybeSingle(),
    client
      .from("leaderboards")
      .select("id, title, subtitle, prize_pool, start_date, end_date")
      .eq("status", "active")
      .order("end_date", { ascending: true })
      .limit(3),
    huntSummary(client),
    // 100 is what the overview has always totalled over. Totals across the
    // whole ledger would need a SUM, and the note at the top of this file
    // says why there are none here.
    client
      .from("transaction_events")
      .select("id, kind, amount, created_at, note")
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  const parsedGivenAway = Number.parseFloat(String(givenAwayRow.data?.value ?? ""))
  const ledgerRows = (ledger.data ?? []) as Transaction[]

  const payload: DashboardPayload = {
    users: { total: usersTotal, recent: usersRecent },
    givenAway: Number.isFinite(parsedGivenAway) ? parsedGivenAway : null,
    redemptions: { total: redemptionsTotal, pending: redemptionsPending },
    wins: { total: winsTotal, pending: winsPending },
    queue: {
      redemptions: redemptionsPending,
      wins: winsPending,
      raffles: rafflesToDraw,
      leaderboards: leaderboardsOverdue,
    },
    leaderboards: (activeLeaderboards.data ?? []) as DashboardPayload["leaderboards"],
    modules: { total: modulesTotal, disabled: modulesDisabled },
    ledger: { totals: totalsFor(ledgerRows), recent: ledgerRows.slice(0, 6) },
    hunt,
  }

  return NextResponse.json(payload)
}

/**
 * The hunt that is on, and how far through its opening it is.
 *
 * Read from `bonus_hunt_kpis` rather than counted here. That view is the
 * single source of truth for a hunt's derived numbers, and counting the
 * bonuses again in this route is how the overview would come to disagree with
 * the hunt page about how many are open.
 *
 * Returns null when there is no active hunt, which the overview renders as
 * "no hunt running" rather than as a progress bar reading 0 of 0.
 */
async function huntSummary(client: Client): Promise<DashboardPayload["hunt"]> {
  const [kpis, state] = await Promise.all([
    client
      .from("bonus_hunt_kpis")
      .select("title, total_bonuses, opened_bonuses, total_won")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.from("opening_state").select("is_opening").limit(1).maybeSingle(),
  ])

  if (kpis.error || !kpis.data) return null

  return {
    title: (kpis.data.title as string | null)?.trim() || null,
    opened: Number(kpis.data.opened_bonuses) || 0,
    total: Number(kpis.data.total_bonuses) || 0,
    isOpening: state.data?.is_opening === true,
  }
}
