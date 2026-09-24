import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { calculateRaffleStatus } from "@/lib/raffle-utils"
import { getSiteSession } from "@/lib/site-session"

/**
 * Buying tickets for a raffle.
 *
 * Rewritten because the original could only ever sell one ticket per person: it
 * treated any existing entry as "already entered" and refused, which made
 * max_tickets meaningless and left tickets_sold at zero forever — so the
 * progress bar on the public page never moved.
 *
 * Runs on the service role. The anon client it used before is subject to RLS on
 * users, so deducting points was at the mercy of whatever policies happen to be
 * on that table.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = (await getSiteSession())?.userId
    if (!userId) return NextResponse.json({ error: "Sign in to enter" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const raffleId = String(body?.raffleId ?? "")
    if (!raffleId) return NextResponse.json({ error: "Missing raffle" }, { status: 400 })

    // How many tickets this call is buying. One unless asked otherwise, and
    // capped at something sane so a crafted request cannot drain a balance.
    const wanted = Math.max(1, Math.min(100, Math.floor(Number(body?.tickets ?? 1)) || 1))

    const client = serviceClient()

    const [{ data: user }, { data: raffle }] = await Promise.all([
      client.from("users").select("id, username, points_balance").eq("id", userId).maybeSingle(),
      client.from("raffles").select("*").eq("id", raffleId).maybeSingle(),
    ])

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (!raffle) return NextResponse.json({ error: "Raffle not found" }, { status: 404 })

    // Derived from the dates rather than trusting the status column, which is
    // only refreshed by a stored procedure that may not have run.
    const status = calculateRaffleStatus(raffle.start_date, raffle.end_date)
    if (status !== "active") {
      return NextResponse.json(
        { error: status === "upcoming" ? "This raffle has not started yet" : "This raffle has ended" },
        { status: 400 },
      )
    }
    if (raffle.winner_username) return NextResponse.json({ error: "This raffle has been drawn" }, { status: 400 })

    const ticketPrice = Number(raffle.ticket_price) || 0
    const isFree = ticketPrice === 0 || raffle.entry_type === "free"

    // Existing entries, both this user's and everyone's, for the two caps.
    const { data: allEntries, error: entriesError } = await client
      .from("raffle_entries")
      .select("id, user_id, tickets_purchased, points_spent")
      .eq("raffle_id", raffleId)

    if (entriesError) {
      console.error("[v0] Could not read raffle entries:", entriesError)
      return NextResponse.json({ error: "Could not enter the raffle" }, { status: 500 })
    }

    const entries = allEntries ?? []
    const mine = entries.find((entry) => entry.user_id === userId) ?? null
    const myTickets = Number(mine?.tickets_purchased) || 0
    const soldTotal = entries.reduce((sum, entry) => sum + (Number(entry.tickets_purchased) || 0), 0)

    const perUserCap = raffle.max_tickets == null ? null : Number(raffle.max_tickets)
    if (perUserCap !== null && myTickets + wanted > perUserCap) {
      const left = Math.max(0, perUserCap - myTickets)
      return NextResponse.json(
        { error: left === 0 ? `You already hold the maximum of ${perUserCap} tickets` : `You can only take ${left} more` },
        { status: 400 },
      )
    }

    const totalCap = raffle.total_tickets_available == null ? null : Number(raffle.total_tickets_available)
    if (totalCap !== null && soldTotal + wanted > totalCap) {
      const left = Math.max(0, totalCap - soldTotal)
      return NextResponse.json(
        { error: left === 0 ? "This raffle is sold out" : `Only ${left} tickets left` },
        { status: 400 },
      )
    }

    const cost = isFree ? 0 : ticketPrice * wanted
    const balance = Number(user.points_balance) || 0
    if (cost > balance) {
      return NextResponse.json({ error: `Not enough points — this costs ${cost}` }, { status: 400 })
    }

    if (cost > 0) {
      // Guarded on the balance we read: if anything else moved it in between,
      // this matches no rows and we stop rather than writing a stale number
      // over someone else's change.
      const { data: deducted, error: deductError } = await client
        .from("users")
        .update({ points_balance: balance - cost })
        .eq("id", userId)
        .eq("points_balance", balance)
        .select("id")

      if (deductError || !deducted || deducted.length === 0) {
        console.error("[v0] Could not deduct points:", deductError)
        return NextResponse.json({ error: "Your balance changed — try again" }, { status: 409 })
      }
    }

    const entryError = mine
      ? (
          await client
            .from("raffle_entries")
            .update({
              tickets_purchased: myTickets + wanted,
              points_spent: (Number(mine.points_spent) || 0) + cost,
            })
            .eq("id", mine.id)
        ).error
      : (
          await client.from("raffle_entries").insert({
            raffle_id: raffleId,
            user_id: userId,
            username: user.username,
            tickets_purchased: wanted,
            ticket_numbers: [],
            points_spent: cost,
          })
        ).error

    if (entryError) {
      console.error("[v0] Could not create raffle entry:", entryError)
      // Give the points back by the amount taken, rather than restoring the
      // old figure — the balance may have moved again since.
      if (cost > 0) {
        const { data: fresh } = await client.from("users").select("points_balance").eq("id", userId).maybeSingle()
        const now = Number(fresh?.points_balance) || 0
        await client.from("users").update({ points_balance: now + cost }).eq("id", userId)
      }
      return NextResponse.json({ error: "Could not enter the raffle" }, { status: 500 })
    }

    // Kept in step with the entries, because the list pages read these
    // instead of scanning every row to count them. Nothing maintained either
    // column before.
    const { error: countError } = await client
      .from("raffles")
      .update({
        tickets_sold: soldTotal + wanted,
        entrant_count: entries.length + (mine ? 0 : 1),
      })
      .eq("id", raffleId)
    if (countError) console.error("[v0] Could not update the raffle counts:", countError)

    return NextResponse.json({
      success: true,
      tickets: myTickets + wanted,
      spent: cost,
      balance: balance - cost,
    })
  } catch (error) {
    console.error("[v0] Error entering raffle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
