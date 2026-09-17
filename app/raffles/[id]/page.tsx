import Link from "next/link"
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { ArrowLeft, Gift, Trophy, Users } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { RaffleCountdown } from "@/components/raffle-countdown"
import RaffleEntryButton from "@/components/raffle-entry-button"
import { calculateRaffleStatus, formatDrawDate } from "@/lib/raffle-utils"

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
    title: `${raffle.title} | Raffles`,
    description: raffle.description || "Enter this raffle to win.",
    openGraph: {
      title: raffle.title,
      description: raffle.description || "Enter this raffle to win.",
      images: raffle.prize_image_url ? [raffle.prize_image_url] : [],
    },
  }
}

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

export default async function RaffleDetailPage({ params }: Params) {
  const { id } = await params
  const raffle = await getRaffle(id)
  if (!raffle) notFound()

  const [entries, cookieStore] = await Promise.all([getEntries(id), cookies()])
  const userId = cookieStore.get("user_db_id")?.value ?? null

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
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-6">
      <Link
        href="/raffles"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 transition hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        All raffles
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{raffle.title}</h1>
          {raffle.description && <p className="mt-1 max-w-2xl text-[13px] text-white/40">{raffle.description}</p>}
        </div>
        <Tag accent={drawn ? "slate" : status === "active" ? "green" : status === "upcoming" ? "blue" : "amber"}>
          {drawn ? "Drawn" : status}
        </Tag>
      </header>

      {drawn && (
        <Panel accent="amber" className="flex items-center gap-3 px-4 py-3">
          <Trophy className="h-5 w-5 shrink-0" style={{ color: ACCENTS.amber }} />
          <div className="min-w-0">
            <MonoLabel className="block text-white/35">Winner</MonoLabel>
            <p className="truncate text-[17px] font-semibold text-white">{raffle.winner_username}</p>
          </div>
          {raffle.winner_ticket_number != null && (
            <MonoLabel className="ml-auto shrink-0 text-white/30">Ticket #{raffle.winner_ticket_number}</MonoLabel>
          )}
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-4">
        <StatTile
          label="Prize"
          value={raffle.prize_name}
          accent="amber"
          hint={raffle.prize_value ? `$${points(raffle.prize_value)} value` : undefined}
        />
        <StatTile
          label="Tickets sold"
          value={points(totalTickets)}
          accent="blue"
          hint={totalCap ? `of ${points(totalCap)}` : "No cap"}
        />
        <StatTile label="Entrants" value={entries.length.toLocaleString()} />
        <StatTile
          label="Your tickets"
          value={points(myTickets)}
          accent="green"
          hint={odds > 0 ? `${odds.toFixed(1)}% of the pot` : undefined}
        />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Panel accent="purple">
          <PanelHeader
            title="Entrants"
            accent="purple"
            right={<MonoLabel className="text-white/25">{entries.length}</MonoLabel>}
          />
          {leaderboard.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Users className="h-7 w-7 text-white/10" />
              <p className="text-[13px] text-white/30">Nobody has entered yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {leaderboard.map((entry, index) => {
                const tickets = Number(entry.tickets_purchased) || 0
                const share = totalTickets > 0 ? (tickets / totalTickets) * 100 : 0
                return (
                  <li key={entry.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/20">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-white">{entry.username}</span>
                    <MonoLabel className="shrink-0 text-white/25">{share.toFixed(1)}%</MonoLabel>
                    <span
                      className="w-16 shrink-0 text-right text-[13px] tabular-nums"
                      style={{ color: ACCENTS.purple }}
                    >
                      {tickets}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel accent={status === "active" && !drawn ? "green" : "slate"} className="p-4">
            {raffle.prize_image_url ? (
              <img
                src={raffle.prize_image_url}
                alt=""
                className="mb-3 h-36 w-full rounded-md border border-white/[0.08] object-cover"
              />
            ) : (
              <div className="mb-3 flex h-36 w-full items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02]">
                <Gift className="h-10 w-10 text-white/10" />
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <MonoLabel className="text-white/30">Entry</MonoLabel>
              <span className="text-[15px] font-semibold" style={{ color: isFree ? ACCENTS.green : ACCENTS.blue }}>
                {isFree ? "Free" : `${points(ticketPrice)} points`}
              </span>
            </div>

            {perUserCap !== null && (
              <div className="mt-1.5 flex items-baseline justify-between">
                <MonoLabel className="text-white/30">Your limit</MonoLabel>
                <span className="text-[13px] tabular-nums text-white/60">
                  {myTickets}/{perUserCap}
                </span>
              </div>
            )}

            {status === "active" && !drawn && (
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <RaffleCountdown endDate={raffle.end_date} />
              </div>
            )}

            <div className="mt-3">
              {drawn ? (
                <p className="text-center text-[13px] text-white/30">This raffle has been drawn.</p>
              ) : status !== "active" ? (
                <p className="text-center text-[13px] text-white/30">
                  {status === "upcoming" ? "Not open yet." : "Entries are closed."}
                </p>
              ) : soldOut ? (
                <p className="text-center text-[13px]" style={{ color: ACCENTS.amber }}>
                  Sold out.
                </p>
              ) : atMyCap ? (
                <p className="text-center text-[13px]" style={{ color: ACCENTS.amber }}>
                  You hold the maximum of {perUserCap} tickets.
                </p>
              ) : !userId ? (
                <p className="text-center text-[13px] text-white/30">Sign in to enter.</p>
              ) : (
                <RaffleEntryButton
                  raffleId={raffle.id}
                  isFree={isFree}
                  ticketPrice={ticketPrice}
                  alreadyHolding={myTickets}
                  perUserCap={perUserCap}
                />
              )}
            </div>
          </Panel>

          <Panel className="space-y-2 p-3.5">
            <Row label="Opens" value={formatDrawDate(raffle.start_date)} />
            <Row label="Closes" value={formatDrawDate(raffle.end_date)} />
            {raffle.draw_date && <Row label="Draw" value={formatDrawDate(raffle.draw_date)} />}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <MonoLabel className="text-white/30">{label}</MonoLabel>
      <span className="text-[12px] text-white/60">{value}</span>
    </div>
  )
}
