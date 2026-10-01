import { ACCENTS } from "@/components/ui/panel"
import { createServerClient } from "@/lib/supabase/server"
import { RaffleSweeper } from "@/components/raffle-sweeper"
import { calculateRaffleStatus } from "@/lib/raffle-utils"
import { PageBody, PageHero } from "@/components/page-hero"
import { SectionHeading } from "@/components/landing/parts"
import {
  FeatureRaffle,
  FinishedRow,
  NoRafflesOpen,
  TicketCard,
  type RaffleEntry,
  type RaffleStatus,
} from "@/components/raffle-cards"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Raffles",
}

/**
 * Every raffle, live ones first.
 *
 * Counts are read off the raffle row, not summed from raffle_entries. This
 * page used to pull the whole entries table on every load just to add it up —
 * a full scan that grows forever, on a page anybody can hit. scripts/049
 * backfilled the counters; the entry route keeps them current.
 */

/**
 * Re-fetched at most this often. Nothing here is per-visitor, so serving the
 * same render to everyone for half a minute turns a query per page view into a
 * query every 30 seconds.
 */
export const revalidate = 30

type Raffle = {
  id: string
  title: string
  description: string | null
  prize_name: string
  prize_value: number | null
  prize_image_url: string | null
  ticket_price: number
  max_tickets: number | null
  total_tickets_available: number | null
  auto_draw: boolean | null
  is_hidden: boolean | null
  tickets_sold: number | null
  entrant_count: number | null
  start_date: string
  end_date: string
  draw_date: string | null
  winner_username: string | null
  featured: boolean
  entry_type: string | null
  code_user_only?: boolean | null
}


async function fetchAll() {
  const supabase = await createServerClient()

  const { data: raffles, error } = await supabase
    .from("raffles")
    .select("*")
    .eq("is_hidden", false)
    .order("featured", { ascending: false })
    .order("end_date")

  if (error) console.error("[v0] Error fetching raffles:", error)

  return { raffles: (raffles ?? []) as Raffle[] }
}

export default async function RafflesPage() {
  const { raffles } = await fetchAll()

  const withStatus: (RaffleEntry & { raffle: Raffle })[] = raffles.map((raffle) => ({
    raffle,
    counts: {
      tickets: Number(raffle.tickets_sold) || 0,
      entrants: Number(raffle.entrant_count) || 0,
    },
    status: (raffle.winner_username ? "drawn" : calculateRaffleStatus(raffle.start_date, raffle.end_date)) as RaffleStatus,
  }))

  const live = withStatus.filter((entry) => entry.status === "active")
  const upcoming = withStatus.filter((entry) => entry.status === "upcoming")
  const past = withStatus.filter((entry) => entry.status === "ended" || entry.status === "drawn")

  // The soonest automatic raffle still to close, so the sweeper can wake up
  // exactly then instead of polling.
  const nextAutoClose =
    live
      .filter((entry) => entry.raffle.auto_draw)
      .map((entry) => entry.raffle.end_date)
      .sort()
      .at(0) ?? null

  const totalPrize = raffles.reduce((sum, raffle) => sum + (Number(raffle.prize_value) || 0), 0)
  const totalEntrants = withStatus.reduce((sum, entry) => sum + entry.counts.entrants, 0)

  const [featured, ...moreLive] = live

  return (
    <div>
      <PageHero
        accent="green"
        title="Raffles"
        subtitle="Spend points on tickets. More tickets, better odds."
        note={live.length > 0 ? `${live.length} open now` : "No draws running"}
        figure={totalPrize > 0 ? `$${Math.round(totalPrize).toLocaleString("en-US")}` : undefined}
        figureLabel="In prizes listed"
      />
      <PageBody className="space-y-16">
        {/* Draws automatic raffles on the second they close. Renders nothing. */}
        <RaffleSweeper nextCloseAt={nextAutoClose} />

        <section className="space-y-6">
          <SectionHeading
            eyebrow="Live"
            title="Open now"
            accent={ACCENTS.green}
            right={
              totalEntrants > 0 ? (
                <span className="text-[13px] text-white/45">
                  {totalEntrants.toLocaleString("en-US")} {totalEntrants === 1 ? "entry" : "entries"} placed
                </span>
              ) : undefined
            }
          />
          {featured ? (
            <>
              <FeatureRaffle entry={featured} />
              {moreLive.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {moreLive.map((entry) => (
                    <TicketCard key={entry.raffle.id} entry={entry} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <NoRafflesOpen />
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="space-y-6">
            <SectionHeading eyebrow="Schedule" title="Coming up" accent={ACCENTS.blue} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((entry) => (
                <TicketCard key={entry.raffle.id} entry={entry} />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="space-y-6">
            <SectionHeading eyebrow="Archive" title="Finished" accent={ACCENTS.slate} />
            <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E12]">
              {past.map((entry) => (
                <FinishedRow key={entry.raffle.id} entry={entry} />
              ))}
            </div>
          </section>
        )}
      </PageBody>
    </div>
  )
}
