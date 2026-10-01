import type React from "react"
import Link from "next/link"
import { ArrowRight, Gift, Lock, Ticket, Trophy, Users } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { RaffleCountdown } from "@/components/raffle-countdown"
import { KickButton } from "@/components/landing/parts"
import { formatDrawDate, isEndingSoon } from "@/lib/raffle-utils"

/**
 * The pieces of the raffles page, in the landing page's language.
 *
 * Kept apart from the page so they render the same anywhere — the page is a
 * cached server render, and these only take plain props.
 */

export type RaffleCardData = {
  id: string
  title: string
  prize_name: string
  prize_value: number | null
  prize_image_url: string | null
  ticket_price: number
  total_tickets_available: number | null
  start_date: string
  end_date: string
  winner_username: string | null
  entry_type: string | null
  code_user_only?: boolean | null
}

export type RaffleCounts = { tickets: number; entrants: number }

export type RaffleStatus = "active" | "upcoming" | "ended" | "drawn"

export type RaffleEntry = { raffle: RaffleCardData; counts: RaffleCounts; status: RaffleStatus }

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString("en-US")

const STATUS: Record<RaffleStatus, { label: string; accent: Accent }> = {
  active: { label: "Open", accent: "green" },
  upcoming: { label: "Coming up", accent: "blue" },
  ended: { label: "Closed", accent: "slate" },
  drawn: { label: "Drawn", accent: "slate" },
}

function isFree(raffle: RaffleCardData) {
  return Number(raffle.ticket_price) === 0 || raffle.entry_type === "free"
}

function Chip({ children, accent }: { children: React.ReactNode; accent: Accent }) {
  const color = ACCENTS[accent]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] backdrop-blur"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}26`, color }}
    >
      {children}
    </span>
  )
}

function Chips({ entry }: { entry: RaffleEntry }) {
  const { raffle, status } = entry
  const meta = STATUS[status]
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip accent={meta.accent}>{meta.label}</Chip>
      {status === "active" && isEndingSoon(raffle.end_date) && <Chip accent="red">Ending soon</Chip>}
      {raffle.code_user_only && (
        <Chip accent="purple">
          <Lock className="h-2.5 w-2.5" /> Code Users
        </Chip>
      )}
    </div>
  )
}

/**
 * The prize picture, whole, set as a card of its own inside ours.
 *
 * The bundled artwork (public/raffles) is itself a finished card: 1600x1000,
 * corners rounded at ~51px with transparent pixels outside them, a 2px border
 * and a blue bar down the left. Set on a dark backing, those transparent
 * corners showed as dark notches along the bottom of every picture. So there
 * is no backing: the picture runs to the card's border, in a frame of
 * exactly its own 8:5 shape, clipped to exactly its own corner radius —
 * 51/1600 of the width by 51/1000 of the height, as a percentage radius so it
 * holds at any size — and the card shows through where the art is clear.
 *
 * Where the picture meets the card's rounded top, its top corners follow the
 * card's curve instead (23px: the card's 24px less its 1px border). Two
 * different curves meeting at one corner read as a mistake — the art's border
 * and blue bar were cut off at an angle there. `frame` sets which corners.
 *
 * object-contain, not cover: an uploaded picture of another shape is shown
 * whole rather than cropped, as before. `inset={false}` is for thumbnails,
 * where the frame is the thumbnail.
 */
/** The artwork's own corners: ~51px on a 1600x1000 card, as percentages. */
export const ART_RADIUS = "rounded-[3.2%/5.1%]"
/** Top corners on the card's curve, bottom corners the artwork's own. */
export const TOP_OF_CARD = "rounded-t-[23px] rounded-b-[3.2%_5.1%]"

export function PrizeImage({
  src,
  className,
  inset = true,
  frame: shape = ART_RADIUS,
}: {
  src: string | null
  className?: string
  inset?: boolean
  frame?: string
}) {
  const frame = (
    <div className={`relative aspect-[8/5] w-full overflow-hidden ${shape}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, any host
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-white/[0.06] bg-white/[0.03]">
          <Gift className="h-10 w-10 text-white/15" />
        </div>
      )}
    </div>
  )
  return inset ? <div className={className}>{frame}</div> : frame
}

/** Tickets sold against the cap, when there is one. */
function FillBar({ tickets, cap, accent }: { tickets: number; cap: number | null; accent: string }) {
  if (cap === null) return null
  const filled = cap > 0 ? Math.min(100, (tickets / cap) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <MonoLabel className="text-white/40">
          {points(tickets)} / {points(cap)} tickets
        </MonoLabel>
        <MonoLabel className="text-white/40">{Math.round(filled)}%</MonoLabel>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${filled}%`, backgroundColor: accent }} />
      </div>
    </div>
  )
}

function Price({ raffle }: { raffle: RaffleCardData }) {
  const free = isFree(raffle)
  return (
    <span className="text-[15px] font-bold tabular-nums" style={{ color: free ? ACCENTS.green : "#FFFFFF" }}>
      {free ? "Free" : `${points(raffle.ticket_price)} pts`}
    </span>
  )
}

/**
 * The first open raffle, given the width it deserves: the prize on one side,
 * the clock and the way in on the other.
 */
export function FeatureRaffle({ entry }: { entry: RaffleEntry }) {
  const { raffle, counts } = entry
  const cap = raffle.total_tickets_available == null ? null : Number(raffle.total_tickets_available)
  const accent = ACCENTS.green

  return (
    <Link
      href={`/raffles/${raffle.id}`}
      className="group relative grid overflow-hidden rounded-3xl border border-white/[0.10] bg-[#0E0E12] transition duration-300 hover:border-white/20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex items-center border-b border-white/[0.07] lg:border-b-0 lg:border-r">
        <PrizeImage src={raffle.prize_image_url} className="w-full" frame={`${TOP_OF_CARD} lg:rounded-[3.2%/5.1%]`} />
      </div>

      <div className="relative flex flex-col gap-6 p-6 sm:p-8">
        <div>
          {/* Beside the artwork rather than on it: the bundled art carries its
              own wording in the corners, and a chip over it covered that. */}
          <Chips entry={entry} />
          <MonoLabel className="mt-5 block" style={{ color: accent }}>Prize</MonoLabel>
          <h3 className="mt-3 text-[clamp(26px,3.4vw,38px)] font-black uppercase leading-[0.95] tracking-[-0.01em] text-white">
            {raffle.prize_name}
          </h3>
          <p className="mt-2 text-[14px] text-white/50">
            {raffle.title}
            {raffle.prize_value ? ` · $${points(raffle.prize_value)} value` : ""}
          </p>
        </div>

        <RaffleCountdown endDate={raffle.end_date} variant="tiles" accent={accent} />

        <FillBar tickets={counts.tickets} cap={cap} accent={accent} />

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/[0.07] pt-5">
          <span className="flex items-center gap-1.5 text-[13px] text-white/50">
            <Users className="h-4 w-4" /> {points(counts.entrants)}
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-white/50">
            <Ticket className="h-4 w-4" /> {points(counts.tickets)}
          </span>
          <Price raffle={raffle} />
          <span
            className="ml-auto inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-black transition group-hover:brightness-110"
            style={{ backgroundColor: accent }}
          >
            Enter raffle <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * Every other raffle, shaped like a ticket: the prize above, a perforation,
 * and a stub with the price and the time.
 */
export function TicketCard({ entry }: { entry: RaffleEntry }) {
  const { raffle, counts, status } = entry
  const cap = raffle.total_tickets_available == null ? null : Number(raffle.total_tickets_available)
  const accent = ACCENTS[STATUS[status].accent]

  return (
    <Link
      href={`/raffles/${raffle.id}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E12] transition duration-300 hover:-translate-y-1 hover:border-white/20"
    >
      <PrizeImage src={raffle.prize_image_url} frame={TOP_OF_CARD} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <Chips entry={entry} />
        <div>
          <h3 className="truncate text-[17px] font-bold text-white">{raffle.prize_name}</h3>
          <p className="mt-0.5 truncate text-[13px] text-white/45">{raffle.title}</p>
        </div>
        <FillBar tickets={counts.tickets} cap={cap} accent={accent} />
      </div>

      {/* The perforation: a dashed tear line with a notch cut at each end. */}
      <div className="relative">
        <div className="mx-5 border-t border-dashed border-white/15" />
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#0B0B0D]" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#0B0B0D]" />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        {status === "active" ? (
          <RaffleCountdown endDate={raffle.end_date} />
        ) : (
          <MonoLabel className="text-white/40">
            {status === "upcoming" ? `Opens ${formatDrawDate(raffle.start_date)}` : `Closed ${formatDrawDate(raffle.end_date)}`}
          </MonoLabel>
        )}
        <Price raffle={raffle} />
      </div>
    </Link>
  )
}

/** A finished raffle: one row, with who won. */
export function FinishedRow({ entry }: { entry: RaffleEntry }) {
  const { raffle, counts } = entry
  return (
    <Link
      href={`/raffles/${raffle.id}`}
      className="group grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,14rem)_auto] sm:px-6"
    >
      <PrizeImage src={raffle.prize_image_url} inset={false} />
      <div className="min-w-0">
        <p className="truncate text-[14.5px] font-semibold text-white">{raffle.prize_name}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-white/40">
          {raffle.title} · {points(counts.entrants)} {counts.entrants === 1 ? "entrant" : "entrants"}
        </p>
      </div>
      <div className="col-span-2 col-start-2 flex min-w-0 items-center gap-2 sm:col-span-1 sm:col-start-auto">
        {raffle.winner_username ? (
          <>
            <Trophy className="h-4 w-4 shrink-0" style={{ color: ACCENTS.amber }} />
            <span className="truncate text-[13.5px] font-semibold text-white/85">{raffle.winner_username}</span>
          </>
        ) : (
          <MonoLabel className="text-white/35">Not drawn yet</MonoLabel>
        )}
      </div>
      <span className="col-start-3 row-start-1 hidden text-right sm:col-start-auto sm:row-start-auto sm:block">
        <MonoLabel className="text-white/35">{formatDrawDate(raffle.end_date)}</MonoLabel>
      </span>
    </Link>
  )
}

/** Nothing open: say so properly, and point at where new ones come from. */
export function NoRafflesOpen() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-14 text-center sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[34rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: ACCENTS.green }}
      />
      <div className="relative mx-auto max-w-md">
        <span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border"
          style={{ borderColor: `${ACCENTS.green}44`, backgroundColor: `${ACCENTS.green}14` }}
        >
          <Ticket className="h-7 w-7" style={{ color: ACCENTS.green }} />
        </span>
        <h3 className="mt-6 text-[24px] font-black uppercase leading-tight text-white">No raffles running</h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-white/50">
          New draws are announced live on stream. Follow on Kick so you are there when the next one opens.
        </p>
        <div className="mt-7 flex justify-center">
          <KickButton />
        </div>
      </div>
    </div>
  )
}
