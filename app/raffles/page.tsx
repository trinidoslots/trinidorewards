import Link from "next/link"
import { Gift, Ticket, Trophy, Users } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"
import { createServerClient } from "@/lib/supabase/server"
import { RaffleCountdown } from "@/components/raffle-countdown"
import { RaffleSweeper } from "@/components/raffle-sweeper"
import { calculateRaffleStatus, formatDrawDate, isEndingSoon } from "@/lib/raffle-utils"
import { PageBody, PageHero } from "@/components/page-hero"
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
}

type Counts = { tickets: number; entrants: number }

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

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

  const withStatus = raffles.map((raffle) => ({
    raffle,
    counts: {
      tickets: Number(raffle.tickets_sold) || 0,
      entrants: Number(raffle.entrant_count) || 0,
    } as Counts,
    status: raffle.winner_username ? "drawn" : calculateRaffleStatus(raffle.start_date, raffle.end_date),
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

  return (
    <div>
      <PageHero
        accent="green"
        title="Raffles"
        subtitle="Spend points on tickets. More tickets, better odds."
      />
      <PageBody className="space-y-4">

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Open now" value={live.length.toLocaleString()} accent="green" />
        <StatTile label="Entries placed" value={totalEntrants.toLocaleString()} accent="blue" />
        <StatTile label="Prize pool listed" value={"$" + points(totalPrize)} accent="amber" />
      </div>

      {/* Draws automatic raffles on the second they close. Renders nothing. */}
      <RaffleSweeper nextCloseAt={nextAutoClose} />

      <Section title="Open now" entries={live} empty="No raffles are running right now." />
      <Section title="Coming up" entries={upcoming} empty={null} />
      <Section title="Finished" entries={past} empty={null} />
      </PageBody>
    </div>
  )
}

function Section({
  title,
  entries,
  empty,
}: {
  title: string
  entries: { raffle: Raffle; counts: Counts; status: string }[]
  empty: string | null
}) {
  if (entries.length === 0 && !empty) return null

  return (
    <section className="space-y-2.5">
      <MonoLabel className="text-white/30">{title}</MonoLabel>
      {entries.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 py-12">
          <Gift className="h-7 w-7 text-white/10" />
          <p className="text-[13px] text-white/30">{empty}</p>
        </Panel>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <RaffleCard key={entry.raffle.id} {...entry} />
          ))}
        </div>
      )}
    </section>
  )
}

function RaffleCard({ raffle, counts, status }: { raffle: Raffle; counts: Counts; status: string }) {
  const isFree = Number(raffle.ticket_price) === 0 || raffle.entry_type === "free"
  const cap = raffle.total_tickets_available == null ? null : Number(raffle.total_tickets_available)
  const filled = cap ? Math.min(100, (counts.tickets / cap) * 100) : 0
  const endingSoon = status === "active" && isEndingSoon(raffle.end_date)
  const accent = status === "active" ? "green" : status === "upcoming" ? "blue" : "slate"

  return (
    <Link href={"/raffles/" + raffle.id} className="block">
      <Panel accent={accent} className="lift h-full overflow-hidden hover:border-white/20">
        <div className="relative">
          {/*
            object-contain in the card's own 8:5 frame, not a cropped h-32
            band. The bundled artwork is a designed card with the prize and the
            wording laid out inside it, and cropping to a fixed height cut the
            sides off whatever it was trying to say. The placeholder keeps the
            same frame so a card without a picture is the same size.
          */}
          {raffle.prize_image_url ? (
            <img src={raffle.prize_image_url} alt="" className="aspect-[8/5] w-full object-contain" />
          ) : (
            <div className="flex aspect-[8/5] w-full items-center justify-center bg-white/[0.02]">
              <Gift className="h-9 w-9 text-white/10" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Tag accent={accent}>{status}</Tag>
            {endingSoon && <Tag accent="red">Ending soon</Tag>}
          </div>
        </div>

        <div className="space-y-2 p-3.5">
          <div>
            <h3 className="truncate text-[14px] font-semibold text-white">{raffle.title}</h3>
            <p className="truncate text-[12px] text-white/35">{raffle.prize_name}</p>
          </div>

          {raffle.winner_username ? (
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.amber }} />
              <span className="truncate text-[12.5px] text-white/70">{raffle.winner_username}</span>
            </div>
          ) : status === "active" ? (
            <RaffleCountdown endDate={raffle.end_date} />
          ) : (
            <MonoLabel className="block text-white/25">
              {status === "upcoming"
                ? "Opens " + formatDrawDate(raffle.start_date)
                : "Closed " + formatDrawDate(raffle.end_date)}
            </MonoLabel>
          )}

          {cap !== null && (
            <div>
              <div className="flex items-baseline justify-between">
                <MonoLabel className="text-white/25">
                  {points(counts.tickets)} / {points(cap)}
                </MonoLabel>
                <MonoLabel className="text-white/25">{Math.round(filled)}%</MonoLabel>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: filled + "%", backgroundColor: ACCENTS[accent] }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-white/[0.06] pt-2">
            <span className="flex items-center gap-1.5 text-[12px] text-white/40">
              <Users className="h-3 w-3" />
              {counts.entrants}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-white/40">
              <Ticket className="h-3 w-3" />
              {points(counts.tickets)}
            </span>
            <span
              className="ml-auto text-[13px] font-semibold"
              style={{ color: isFree ? ACCENTS.green : ACCENTS.blue }}
            >
              {isFree ? "Free" : points(raffle.ticket_price) + " pts"}
            </span>
          </div>
        </div>
      </Panel>
    </Link>
  )
}
