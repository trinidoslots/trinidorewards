import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { drawWinner } from "@/lib/raffle-utils"

type Client = ReturnType<typeof serviceClient>

/**
 * Hands the prize over.
 *
 * Points go straight onto the winner's balance, because that is a number this
 * site owns and there is nothing for a human to do. Cash and items go on the
 * winner log as owed, because paying them out happens somewhere else.
 *
 * Every prize is logged either way — the points one marked paid, since it
 * already has been. A win that only exists as a balance change leaves no record
 * of what it was for.
 *
 * Nothing here can fail the draw: the winner is already decided and written,
 * and refusing to record that because a side effect went wrong would be worse
 * than a missing log line.
 */
async function awardPrize(
  client: Client,
  raffle: { id: string; title: string; prize_name: string; prize_value: number | null; prize_type: string | null },
  username: string,
) {
  const prizeType = raffle.prize_type ?? "cash"
  const value = Number(raffle.prize_value) || 0

  // The account behind the name, if there is one. Giveaway-style winners from
  // chat may have none, in which case the win is logged against the name alone.
  const { data: user } = await client.from("users").select("id, points_balance").ilike("username", username).maybeSingle()

  let credited = false
  if (prizeType === "points" && value > 0 && user) {
    const balance = Number(user.points_balance) || 0
    const { error } = await client
      .from("users")
      .update({ points_balance: balance + value })
      .eq("id", user.id)
      // Guarded, as everywhere else points move: a concurrent change fails the
      // update rather than being written over.
      .eq("points_balance", balance)

    if (error) console.error("[v0] Could not credit raffle points:", error)
    else credited = true
  }

  const { error: logError } = await client.from("win_logs").insert({
    user_id: user?.id ?? null,
    username,
    source: "raffle",
    source_ref: raffle.title,
    prize: raffle.prize_name || raffle.title,
    amount: prizeType === "cash" && value > 0 ? value : null,
    points: prizeType === "points" && value > 0 ? value : null,
    // Points are settled the moment they are credited. Cash is owed.
    status: credited ? "paid" : "pending",
    note: prizeType === "points" && value > 0 && !user ? "No account matched — points not credited" : null,
    paid_at: credited ? new Date().toISOString() : null,
  })

  if (logError) console.error("[v0] Could not log the raffle win:", logError)
}

/** Draws one raffle and writes the result. Shared by the button and the sweep. */
async function drawOne(client: Client, raffleId: string, award = true) {
  const { data: entries, error } = await client
    .from("raffle_entries")
    .select("id, username, tickets_purchased")
    .eq("raffle_id", raffleId)
    .order("created_at")

  if (error) {
    console.error("[v0] Could not read entries for the draw:", error)
    return { error: "Could not read the entries" as const }
  }

  const result = drawWinner(entries ?? [])
  if (!result) return { error: "Nobody has entered this raffle" as const }

  // Guarded on the winner still being empty. The database cron, a page nudge
  // and the admin button can all fire at once; without this, the last one to
  // finish would overwrite the winner everybody already saw.
  const { data: written, error: writeError } = await client
    .from("raffles")
    .update({
      winner_username: result.username,
      winner_ticket_number: result.ticketNumber,
      status: "drawn",
      draw_date: new Date().toISOString(),
      // Reconciled here too: the draw has just read every entry, so it is the
      // cheapest place to correct a counter that has drifted.
      tickets_sold: result.totalTickets,
      entrant_count: (entries ?? []).length,
    })
    .eq("id", raffleId)
    .is("winner_username", null)
    .select("id, winner_username, winner_ticket_number")

  if (writeError) {
    console.error("[v0] Could not record the winner:", writeError)
    return { error: "Could not record the winner" as const }
  }

  if (!written || written.length === 0) {
    // Somebody got there first. Report theirs, not the one just rolled.
    const { data: existing } = await client
      .from("raffles")
      .select("winner_username, winner_ticket_number")
      .eq("id", raffleId)
      .maybeSingle()

    if (existing?.winner_username) {
      return {
        result: {
          username: existing.winner_username,
          entryId: "",
          ticketNumber: Number(existing.winner_ticket_number) || result.ticketNumber,
          totalTickets: result.totalTickets,
        },
      }
    }
    return { error: "Could not record the winner" as const }
  }

  // Only after the guarded write succeeded, so exactly one caller hands the
  // prize over however many of them raced for it.
  if (award) {
    const { data: raffle } = await client
      .from("raffles")
      .select("id, title, prize_name, prize_value, prize_type")
      .eq("id", raffleId)
      .maybeSingle()

    if (raffle) await awardPrize(client, raffle, result.username)
  }

  return { result }
}

/**
 * Draws every automatic raffle whose time is up.
 *
 * Triggered by page loads rather than a schedule: the hosting plan only allows
 * one cron a day, which is far too slow for something people are waiting on.
 * Anyone opening the raffles page moves it along, and the daily cron is the
 * backstop for a quiet night.
 */
async function sweepDue(client: Client) {
  const { data: due, error } = await client
    .from("raffles")
    .select("id, title")
    .eq("auto_draw", true)
    .is("winner_username", null)
    .lt("end_date", new Date().toISOString())
    .limit(25)

  if (error) {
    console.error("[v0] Could not list raffles due a draw:", error)
    return []
  }

  const drawn: { id: string; title: string; username: string }[] = []
  for (const raffle of due ?? []) {
    const outcome = await drawOne(client, raffle.id)
    // A raffle nobody entered has no winner; leave it for a human to delete
    // rather than retrying it on every page load forever.
    if ("result" in outcome && outcome.result) {
      drawn.push({ id: raffle.id, title: raffle.title, username: outcome.result.username })
    }
  }

  // /raffles is served from a 30-second cache, so without this the winner
  // would not appear until that expired — on the one page people are watching
  // for exactly this.
  if (drawn.length > 0) {
    revalidatePath("/raffles")
    for (const raffle of drawn) revalidatePath(`/raffles/${raffle.id}`)
  }

  return drawn
}

/**
 * Drawing a raffle.
 *
 * Done here rather than through the draw_raffle_winner stored procedure the
 * admin page used to call: that procedure is not in any migration in this
 * repo, so on a database where it was never created the button failed with a
 * Postgres error and no winner could be drawn at all.
 *
 * Weighted by tickets — see drawWinner.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const client = serviceClient()

  // The sweep is open, because it only does what the raffle was already set to
  // do and takes no argument that could aim it somewhere. Drawing a specific
  // raffle by hand still needs an admin session.
  if (body?.due) {
    return NextResponse.json({ drawn: await sweepDue(client) })
  }

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const raffleId = String(body?.raffleId ?? "")
  if (!raffleId) return NextResponse.json({ error: "Missing raffle" }, { status: 400 })

  const { data: raffle } = await client
    .from("raffles")
    .select("id, title, winner_username")
    .eq("id", raffleId)
    .maybeSingle()

  if (!raffle) return NextResponse.json({ error: "Raffle not found" }, { status: 404 })
  if (raffle.winner_username && !body?.redraw) {
    return NextResponse.json({ error: "This raffle has already been drawn" }, { status: 400 })
  }

  if (raffle.winner_username && body?.redraw) {
    await client.from("raffles").update({ winner_username: null }).eq("id", raffleId)
  }

  // A redraw does not hand the prize over again: the first winner has already
  // been credited or logged, and a correction is not a second prize.
  const outcome = await drawOne(client, raffleId, !body?.redraw)
  if ("error" in outcome && outcome.error) {
    const status = outcome.error === "Nobody has entered this raffle" ? 400 : 500
    return NextResponse.json({ error: outcome.error }, { status })
  }

  return NextResponse.json({ ...outcome.result, title: raffle.title })
}

/** The daily cron backstop, for raffles that closed with nobody browsing. */
export async function GET() {
  return NextResponse.json({ drawn: await sweepDue(serviceClient()) })
}
