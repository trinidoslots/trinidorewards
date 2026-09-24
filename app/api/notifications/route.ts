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
 * Read or unread is the browser's business (the bell remembers when it was
 * last opened). Nothing here changes when a notification is seen.
 */

export const dynamic = "force-dynamic"

export type SiteNotification = {
  id: string
  kind: "raffle_won" | "redemption_submitted" | "redemption_confirmed"
  title: string
  body: string
  at: string
  href: string
}

const LIMIT = 20

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

  const { data: user } = await client.from("users").select("username").eq("id", userId).maybeSingle()
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
    })
    if (redemption.status === "completed") {
      items.push({
        id: `redemption-${redemption.id}-confirmed`,
        kind: "redemption_confirmed",
        title: "Redemption confirmed",
        body: name,
        at: String(redemption.updated_at ?? created),
        href: "/profile?tab=redemptions",
      })
    }
  }

  items.sort((a, b) => Date.parse(b.at || "0") - Date.parse(a.at || "0"))
  return NextResponse.json({ notifications: items.filter((item) => item.at).slice(0, LIMIT) })
}
