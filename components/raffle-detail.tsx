import Link from "next/link"
import { ArrowLeft, Lock, Users } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { PageBody, PageHero } from "@/components/page-hero"
import { RaffleCountdown } from "@/components/raffle-countdown"
import { RaffleLiveDraw } from "@/components/raffle-live-draw"
import RaffleEntryButton from "@/components/raffle-entry-button"
import { PrizeImage, TOP_OF_CARD } from "@/components/raffle-cards"
import { formatDrawDate } from "@/lib/raffle-utils"

/**
 * One raffle, laid out: the draw and the prize and who is in on the left, and
 * your own entry — the clock, the picker, your odds — on the right, where it
 * stays in view while the list scrolls.
 *
 * Presentational only. app/raffles/[id]/page.tsx reads the raffle, the entries
 * and the visitor and hands everything here worked out.
 */

export type RaffleDetailEntry = { id: string; username: string; tickets: number; mine: boolean }

export type RaffleDetailProps = {
  raffle: {
    id: string
    title: string
    description: string | null
    prize_name: string
    prize_value: number | null
    prize_image_url: string | null
    start_date: string
    end_date: string
    draw_date: string | null
    winner_username: string | null
    winner_ticket_number: number | null
  }
  status: "upcoming" | "active" | "ended"
  drawn: boolean
  isFree: boolean
  ticketPrice: number
  /** Every entry, for the draw reel. */
  allEntries: { username: string; tickets_purchased: number }[]
  /** The ones listed, most tickets first. */
  leaderboard: RaffleDetailEntry[]
  entrantCount: number
  totalTickets: number
  totalCap: number | null
  perUserCap: number | null
  myTickets: number
  odds: number
  soldOut: boolean
  atMyCap: boolean
  codeUserOnly: boolean
  isCodeUser: boolean
  signedIn: boolean
}

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString("en-US")

export function RaffleDetailView(props: RaffleDetailProps) {
  const { raffle, status, drawn } = props
  const accent: Accent = drawn ? "slate" : status === "active" ? "green" : status === "upcoming" ? "blue" : "amber"
  const statusLabel = drawn ? "Drawn" : status === "active" ? "Open" : status === "upcoming" ? "Coming up" : "Closed"

  return (
    <div>
      <PageHero
        accent={accent}
        title={raffle.title}
        subtitle={raffle.description}
        note={props.codeUserOnly ? `${statusLabel} · Code Users only` : statusLabel}
        figure={raffle.prize_value ? `$${points(raffle.prize_value)}` : undefined}
        figureLabel="Prize value"
        actions={
          <Link
            href="/raffles"
            className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
            All raffles
          </Link>
        }
      />

      <PageBody>
        {/*
          Three grid items, so a phone can take them in a different order: the
          way in comes straight after the prize there, not after a list of
          every entrant. Side by side, the entry panel spans both rows on the
          right and stays in view while the list scrolls.
        */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
            <RaffleLiveDraw
              raffleId={raffle.id}
              endsAt={raffle.end_date}
              initialWinner={raffle.winner_username ?? null}
              initialTicketNumber={raffle.winner_ticket_number ?? null}
              entries={props.allEntries}
            />
            <PrizeCard {...props} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <EntryPanel {...props} accent={ACCENTS[accent]} />
            <Dates raffle={raffle} />
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <Entrants {...props} />
          </div>
        </div>
      </PageBody>
    </div>
  )
}

function PrizeCard({ raffle, totalTickets, totalCap, entrantCount, isFree, ticketPrice }: RaffleDetailProps) {
  const filled = totalCap ? Math.min(100, (totalTickets / totalCap) * 100) : 0
  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E12]">
      <PrizeImage src={raffle.prize_image_url} frame={TOP_OF_CARD} />
      <div className="p-6 sm:p-7">
        <MonoLabel style={{ color: ACCENTS.amber }}>Prize</MonoLabel>
        <h2 className="mt-3 text-[clamp(26px,3.6vw,40px)] font-black uppercase leading-[0.95] text-white">
          {raffle.prize_name}
        </h2>

        <dl className="mt-6 grid grid-cols-3 divide-x divide-white/[0.07] rounded-2xl border border-white/[0.07]">
          <Figure label="Tickets sold" value={points(totalTickets)} hint={totalCap ? `of ${points(totalCap)}` : "No cap"} />
          <Figure label="Entrants" value={points(entrantCount)} />
          <Figure
            label="Per ticket"
            value={isFree ? "Free" : `${points(ticketPrice)} pts`}
            color={isFree ? ACCENTS.green : undefined}
          />
        </dl>

        {totalCap !== null && (
          <div className="mt-5">
            <div className="flex justify-between">
              <MonoLabel className="text-white/40">Filled</MonoLabel>
              <MonoLabel className="text-white/40">{Math.round(filled)}%</MonoLabel>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${filled}%`, backgroundColor: ACCENTS.green }} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Figure({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="px-4 py-4">
      <dt>
        <MonoLabel className="text-white/35">{label}</MonoLabel>
      </dt>
      <dd className="mt-1.5 truncate text-[20px] font-bold tabular-nums" style={{ color: color ?? "#FFFFFF" }}>
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-[12px] text-white/35">{hint}</p>}
    </div>
  )
}

/** Who is in, most tickets first, with each one's share of the pot. */
function Entrants({ leaderboard, entrantCount, totalTickets }: RaffleDetailProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E12]">
      <header className="flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <Users className="h-4 w-4" style={{ color: ACCENTS.purple }} />
        <MonoLabel className="text-white/70">Entrants</MonoLabel>
        <span className="ml-auto text-[12.5px] text-white/40">
          {points(entrantCount)} {entrantCount === 1 ? "person" : "people"}
          {leaderboard.length < entrantCount ? ` · top ${leaderboard.length}` : ""}
        </span>
      </header>
      {leaderboard.length === 0 ? (
        <p className="py-14 text-center text-[13px] text-white/30">Nobody has entered yet.</p>
      ) : (
        <ol>
          {leaderboard.map((entry, index) => {
            const share = totalTickets > 0 ? (entry.tickets / totalTickets) * 100 : 0
            return (
              <li
                key={entry.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-white/[0.05] px-5 py-3 last:border-b-0 sm:px-6"
                style={entry.mine ? { backgroundColor: `${ACCENTS.green}0f` } : undefined}
              >
                <span className="font-mono text-[12px] tabular-nums text-white/35">{String(index + 1).padStart(2, "0")}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[13px] font-semibold uppercase text-white/60">
                    {(entry.username || "?").charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-white">{entry.username}</span>
                      {entry.mine && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-black"
                          style={{ backgroundColor: ACCENTS.green }}
                        >
                          You
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block h-[3px] w-full max-w-[12rem] overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(2, share)}%`, backgroundColor: ACCENTS.purple }} />
                    </span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[14px] font-bold tabular-nums text-white">
                    {points(entry.tickets)} <span className="text-[12px] font-medium text-white/40">{entry.tickets === 1 ? "ticket" : "tickets"}</span>
                  </span>
                  <MonoLabel className="text-white/35">{share.toFixed(1)}%</MonoLabel>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** Your side of it: what you hold, the clock, and the way in. */
function EntryPanel(props: RaffleDetailProps & { accent: string }) {
  const { raffle, status, drawn, accent, myTickets, odds, perUserCap } = props
  const open = status === "active" && !drawn

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/[0.10] bg-[#0E0E12] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: accent }}
      />
      <div className="relative space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <MonoLabel className="text-white/40">Your tickets</MonoLabel>
            <p className="mt-2 text-[34px] font-black leading-none tabular-nums text-white">{points(myTickets)}</p>
            {perUserCap !== null && <p className="mt-1.5 text-[12px] text-white/40">limit {points(perUserCap)}</p>}
          </div>
          <div>
            <MonoLabel className="text-white/40">Your odds</MonoLabel>
            <p className="mt-2 text-[34px] font-black leading-none tabular-nums" style={{ color: odds > 0 ? ACCENTS.green : "rgba(255,255,255,0.25)" }}>
              {odds > 0 ? `${odds.toFixed(odds < 10 ? 1 : 0)}%` : "—"}
            </p>
            <p className="mt-1.5 text-[12px] text-white/40">of all tickets</p>
          </div>
        </div>

        {open && (
          <div className="border-t border-white/[0.07] pt-6">
            <RaffleCountdown endDate={raffle.end_date} variant="tiles" accent={accent} />
          </div>
        )}

        <div className="border-t border-white/[0.07] pt-6">
          <EntryAction {...props} />
        </div>
      </div>
    </section>
  )
}

/** Whichever of the reasons applies, or the picker. */
function EntryAction({
  raffle,
  status,
  drawn,
  soldOut,
  atMyCap,
  perUserCap,
  codeUserOnly,
  isCodeUser,
  signedIn,
  isFree,
  ticketPrice,
  myTickets,
}: RaffleDetailProps) {
  const note = (text: string, color?: string) => (
    <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-center text-[13.5px]" style={{ color: color ?? "rgba(255,255,255,0.5)" }}>
      {text}
    </p>
  )

  if (drawn) return note("This raffle has been drawn.")
  if (status !== "active") return note(status === "upcoming" ? `Opens ${formatDrawDate(raffle.start_date)}.` : "Entries are closed.")
  if (soldOut) return note("Sold out.", ACCENTS.amber)
  if (atMyCap) return note(`You hold the maximum of ${perUserCap} tickets.`, ACCENTS.amber)
  if (codeUserOnly && !isCodeUser)
    return (
      <p
        className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-[13.5px] font-semibold"
        style={{ borderColor: `${ACCENTS.purple}55`, backgroundColor: `${ACCENTS.purple}14`, color: ACCENTS.purple }}
      >
        <Lock className="h-4 w-4" /> Code Users only
      </p>
    )
  if (!signedIn) return note("Sign in to enter.")

  return (
    <RaffleEntryButton
      raffleId={raffle.id}
      isFree={isFree}
      ticketPrice={ticketPrice}
      alreadyHolding={myTickets}
      perUserCap={perUserCap}
    />
  )
}

function Dates({ raffle }: Pick<RaffleDetailProps, "raffle">) {
  const rows: [string, string][] = [
    ["Opens", formatDrawDate(raffle.start_date)],
    ["Closes", formatDrawDate(raffle.end_date)],
  ]
  if (raffle.draw_date) rows.push(["Draw", formatDrawDate(raffle.draw_date)])
  return (
    <dl className="divide-y divide-white/[0.06] rounded-3xl border border-white/[0.08] bg-[#0E0E12] px-6">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-3.5">
          <dt>
            <MonoLabel className="text-white/40">{label}</MonoLabel>
          </dt>
          <dd className="text-[13px] text-white/70">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
