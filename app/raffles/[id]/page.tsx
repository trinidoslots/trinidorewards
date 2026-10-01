import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { calculateRaffleStatus } from "@/lib/raffle-utils"
import { RaffleDetailView } from "@/components/raffle-detail"
import { getSiteSession } from "@/lib/site-session"
import { serviceClient } from "@/lib/supabase/service"

// No static `metadata` here: generateMetadata below names the page after the
// raffle itself, and a route may declare one or the other, never both.

/**
 * One raffle.
 *
 * `params` is awaited: it is a Promise in this version of Next, and reading
 * `.id` straight off it gave undefined — so every raffle detail page 404'd.
 * Nobody could open a raffle, let alone enter one.
 */

type Params = { params: Promise<{ id: string }> }

async function getRaffle(id: string) {
  const supabase = await createServerClient()
  const { data } = await supabase.from("raffles").select("*").eq("id", id).maybeSingle()
  // Hidden means hidden, including from anyone holding the link.
  return data?.is_hidden ? null : data
}

async function getEntries(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("raffle_entries")
    .select("id, username, tickets_purchased, user_id")
    .eq("raffle_id", id)
  if (error) console.error("[v0] Error fetching raffle entries:", error)
  return data ?? []
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params
  const raffle = await getRaffle(id)
  if (!raffle) return { title: "Raffle not found" }

  return {
    // Just the raffle's name — the root layout's template appends the brand,
    // so "X | Raffles" here would come out as "X | Raffles · TrinidoRewards".
    title: raffle.title,
    description: raffle.description || "Enter this raffle to win.",
    openGraph: {
      title: raffle.title,
      description: raffle.description || "Enter this raffle to win.",
      images: raffle.prize_image_url ? [raffle.prize_image_url] : [],
    },
  }
}

export default async function RaffleDetailPage({ params }: Params) {
  const { id } = await params
  const raffle = await getRaffle(id)
  if (!raffle) notFound()

  const [entries, session] = await Promise.all([getEntries(id), getSiteSession()])
  const userId = session?.userId ?? null

  // Only asked for on a Code-User-only raffle. users is private, so through the
  // service role, for the signed-in user's own row. "*": the column arrives with 076.
  const codeUserOnly = raffle.code_user_only === true
  let isCodeUser = false
  if (codeUserOnly && userId) {
    const { data } = await serviceClient().from("users").select("*").eq("id", userId).maybeSingle()
    isCodeUser = data?.is_code_user === true
  }

  const totalTickets = entries.reduce((sum, entry) => sum + (Number(entry.tickets_purchased) || 0), 0)
  const mine = userId ? entries.find((entry) => entry.user_id === userId) : null
  const myTickets = Number(mine?.tickets_purchased) || 0

  const ticketPrice = Number(raffle.ticket_price) || 0
  const isFree = ticketPrice === 0 || raffle.entry_type === "free"
  const status = calculateRaffleStatus(raffle.start_date, raffle.end_date)
  const drawn = !!raffle.winner_username

  const perUserCap = raffle.max_tickets == null ? null : Number(raffle.max_tickets)
  const totalCap = raffle.total_tickets_available == null ? null : Number(raffle.total_tickets_available)
  const soldOut = totalCap !== null && totalTickets >= totalCap
  const atMyCap = perUserCap !== null && myTickets >= perUserCap

  // Odds from the tickets actually held, not from the entrant count.
  const odds = totalTickets > 0 && myTickets > 0 ? (myTickets / totalTickets) * 100 : 0

  const leaderboard = [...entries]
    .sort((a, b) => (Number(b.tickets_purchased) || 0) - (Number(a.tickets_purchased) || 0))
    .slice(0, 12)

  return (
    <RaffleDetailView
      raffle={{
        id: raffle.id,
        title: raffle.title,
        description: raffle.description ?? null,
        prize_name: raffle.prize_name,
        prize_value: raffle.prize_value == null ? null : Number(raffle.prize_value),
        prize_image_url: raffle.prize_image_url ?? null,
        start_date: raffle.start_date,
        end_date: raffle.end_date,
        draw_date: raffle.draw_date ?? null,
        winner_username: raffle.winner_username ?? null,
        winner_ticket_number: raffle.winner_ticket_number ?? null,
      }}
      status={status}
      drawn={drawn}
      isFree={isFree}
      ticketPrice={ticketPrice}
      allEntries={entries.map((entry) => ({
        username: entry.username,
        tickets_purchased: Number(entry.tickets_purchased) || 0,
      }))}
      leaderboard={leaderboard.map((entry) => ({
        id: String(entry.id),
        username: entry.username,
        tickets: Number(entry.tickets_purchased) || 0,
        mine: !!userId && entry.user_id === userId,
      }))}
      entrantCount={entries.length}
      totalTickets={totalTickets}
      totalCap={totalCap}
      perUserCap={perUserCap}
      myTickets={myTickets}
      odds={odds}
      soldOut={soldOut}
      atMyCap={atMyCap}
      codeUserOnly={codeUserOnly}
      isCodeUser={isCodeUser}
      signedIn={!!userId}
    />
  )
}
