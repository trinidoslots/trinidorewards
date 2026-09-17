import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { drawWinner } from "@/lib/raffle-utils"

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
  const supabase = await createServerClient()
  const {
    data: { user: admin },
  } = await supabase.auth.getUser()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const raffleId = String(body?.raffleId ?? "")
  if (!raffleId) return NextResponse.json({ error: "Missing raffle" }, { status: 400 })

  const client = serviceClient()

  const { data: raffle } = await client.from("raffles").select("id, title, winner_username").eq("id", raffleId).maybeSingle()
  if (!raffle) return NextResponse.json({ error: "Raffle not found" }, { status: 404 })
  if (raffle.winner_username && !body?.redraw) {
    return NextResponse.json({ error: "This raffle has already been drawn" }, { status: 400 })
  }

  const { data: entries, error } = await client
    .from("raffle_entries")
    .select("id, username, tickets_purchased")
    .eq("raffle_id", raffleId)
    .order("created_at")

  if (error) {
    console.error("[v0] Could not read entries for the draw:", error)
    return NextResponse.json({ error: "Could not read the entries" }, { status: 500 })
  }

  const result = drawWinner(entries ?? [])
  if (!result) return NextResponse.json({ error: "Nobody has entered this raffle" }, { status: 400 })

  const { error: writeError } = await client
    .from("raffles")
    .update({
      winner_username: result.username,
      winner_ticket_number: result.ticketNumber,
      status: "drawn",
      draw_date: new Date().toISOString(),
    })
    .eq("id", raffleId)

  if (writeError) {
    console.error("[v0] Could not record the winner:", writeError)
    return NextResponse.json({ error: "Could not record the winner" }, { status: 500 })
  }

  return NextResponse.json({ ...result, title: raffle.title })
}
