"use client"

import Link from "next/link"
import type React from "react"
import { ArrowRight, ArrowUpRight, Ticket, Trophy } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { countdownTo } from "@/lib/schedule-week"
import { money, moneyExact } from "@/lib/leaderboard-format"
import { huntProgress, type HuntSnapshot } from "@/lib/landing"
import type { ScheduleEntry } from "@/lib/schedule"
import type { LandingBoard, LandingRaffle, LandingWin } from "@/hooks/use-landing-data"
import { KICK_GREEN, KickButton, LiveDot, SectionHeading, shortLeft } from "@/components/landing/parts"

/* -------------------------------------------------------------------------- */
/*                                Winners ticker                              */
/* -------------------------------------------------------------------------- */

/**
 * Recent winners, scrolling, with a fixed label at the left edge.
 *
 * Real rows from the winner log; renders nothing when the log is empty rather
 * than inventing filler. The track is duplicated and translated by half its
 * width (see .marquee-track) so the loop has no seam.
 */
export function WinnersTicker({ wins }: { wins: LandingWin[] }) {
  if (wins.length === 0) return null
  const duration = Math.max(22, wins.length * 5)
  const track = [...wins, ...wins]

  return (
    <div className="marquee relative flex w-full items-stretch overflow-hidden border-b border-white/[0.06] bg-[#0A0A0D]">
      <div
        className="relative z-10 flex shrink-0 items-center gap-2 px-4 sm:px-6"
        style={{ backgroundColor: ACCENTS.green }}
      >
        <Trophy className="h-4 w-4 text-black" />
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-black">Paid out</span>
      </div>
      <div className="marquee-mask relative min-w-0 flex-1 overflow-hidden py-3.5">
        <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
          {track.map((win, index) => (
            <div
              key={`${win.id}-${index}`}
              className="flex shrink-0 items-center gap-2.5 px-6"
              aria-hidden={index >= wins.length}
            >
              <span className="whitespace-nowrap text-[14px] font-semibold text-white/85">{win.username}</span>
              <span className="whitespace-nowrap text-[14px] font-semibold tabular-nums" style={{ color: ACCENTS.green }}>
                {win.prize}
              </span>
              <span className="ml-4 h-1 w-1 rotate-45 bg-white/20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Live deck                                  */
/* -------------------------------------------------------------------------- */

/**
 * What is running, each in a card shaped like the thing it is: a hunt as a
 * progress ring, a leaderboard as a podium, a raffle as a ticket. Only what
 * exists is rendered — an empty "no hunt running" card is just bareness moved
 * one level in.
 */
export function LiveDeck({
  hunt,
  board,
  raffle,
  now,
}: {
  hunt: HuntSnapshot | null
  board: LandingBoard | null
  raffle: LandingRaffle | null
  now: number
}) {
  if (!hunt && !board && !raffle) return null
  const count = [hunt, board, raffle].filter(Boolean).length

  return (
    <section className="mx-auto max-w-6xl px-5 pt-20 lg:px-8">
      <SectionHeading
        eyebrow="Live"
        title="Running right now"
        accent={ACCENTS.red}
        right={
          <span className="flex items-center gap-2 text-[12.5px] text-white/40">
            <LiveDot color={ACCENTS.red} size={7} />
            Updates with the stream
          </span>
        }
      />
      <div className={`mt-8 grid gap-4 ${count >= 2 ? "lg:grid-cols-2" : ""}`}>
        {hunt && <HuntCard hunt={hunt} wide={count === 3} />}
        {board && <BoardCard board={board} now={now} />}
        {raffle && <RaffleCard raffle={raffle} now={now} />}
      </div>
    </section>
  )
}

function DeckCard({
  href,
  accent,
  label,
  className,
  children,
}: {
  href: string
  accent: string
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E12] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 sm:p-7 ${className ?? ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-50"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
          <MonoLabel style={{ color: accent }}>{label}</MonoLabel>
          <span className="ml-auto flex items-center gap-1 text-[12.5px] font-semibold text-white/40 transition group-hover:text-white">
            Open
            <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
        {children}
      </div>
    </Link>
  )
}

function HuntCard({ hunt, wide }: { hunt: HuntSnapshot; wide: boolean }) {
  const progress = huntProgress(hunt)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const accent = ACCENTS.amber

  return (
    <DeckCard href="/bonushunt" accent={accent} label="Bonus hunt" className={wide ? "lg:col-span-2" : ""}>
      <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-6">
        <div className="relative h-[136px] w-[136px] shrink-0">
          <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90">
            <circle cx="68" cy="68" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
            <circle
              cx="68"
              cy="68"
              r={radius}
              fill="none"
              stroke={accent}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress.percent / 100)}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[30px] font-black leading-none tabular-nums text-white">{progress.percent}%</span>
            <MonoLabel className="mt-1.5 text-white/40">opened</MonoLabel>
          </div>
        </div>

        {/* A floor on the width, so on a phone this drops under the ring
            instead of squeezing beside it and clipping the balance. */}
        <div className="min-w-[14rem] flex-1">
          <p className="text-[clamp(34px,4.4vw,48px)] font-black leading-none tabular-nums tracking-[-0.02em] text-white">
            {moneyExact(hunt.currentBalance)}
          </p>
          <p className="mt-2 text-[14px] text-white/45">
            <span className="font-semibold" style={{ color: progress.ahead ? ACCENTS.green : ACCENTS.red }}>
              {progress.ahead ? "+" : "−"}
              {moneyExact(Math.abs(progress.profit))}
            </span>{" "}
            against a {moneyExact(hunt.startingBalance)} start
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip>{progress.label}</Chip>
            {hunt.bestMultiplier > 0 && (
              <Chip accent={accent}>
                Best {hunt.bestMultiplier.toFixed(0)}x{hunt.bestMultiplierGame ? ` · ${hunt.bestMultiplierGame}` : ""}
              </Chip>
            )}
          </div>
        </div>
      </div>
    </DeckCard>
  )
}

function BoardCard({ board, now }: { board: LandingBoard; now: number }) {
  const accent = ACCENTS.blue
  // Second, first, third — the podium's own order, so first stands in the middle.
  const podium = [
    { place: 2, name: board.top[1], height: "h-16" },
    { place: 1, name: board.top[0], height: "h-24" },
    { place: 3, name: board.top[2], height: "h-11" },
  ]

  return (
    <DeckCard href="/leaderboard" accent={accent} label="Leaderboard">
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[clamp(34px,4.4vw,48px)] font-black leading-none tabular-nums tracking-[-0.02em] text-white">
            {money(board.pool)}
          </p>
          <p className="mt-2 text-[14px] text-white/45">
            Prize pool · ends in {shortLeft(countdownTo(board.endsAt, now), "—")}
          </p>
        </div>
      </div>

      {board.top.length > 0 ? (
        <div className="mt-7 grid grid-cols-3 items-end gap-2">
          {podium.map((step) => (
            <div key={step.place} className="min-w-0 text-center">
              <p className="truncate px-1 text-[12.5px] font-semibold text-white/80">{step.name ?? "—"}</p>
              <div
                className={`mt-2 flex items-start justify-center rounded-t-xl border border-b-0 pt-2 ${step.height}`}
                style={{
                  borderColor: step.place === 1 ? `${accent}66` : "rgba(255,255,255,0.08)",
                  background:
                    step.place === 1
                      ? `linear-gradient(to bottom, ${accent}33, ${accent}05)`
                      : "linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
                }}
              >
                <span
                  className="font-mono text-[13px] font-bold tabular-nums"
                  style={{ color: step.place === 1 ? accent : "rgba(255,255,255,0.5)" }}
                >
                  {step.place}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-7 text-[13px] text-white/35">No entries yet — the first wager takes first place.</p>
      )}
    </DeckCard>
  )
}

function RaffleCard({ raffle, now }: { raffle: LandingRaffle; now: number }) {
  const accent = ACCENTS.pink
  const left = raffle.endsAt ? countdownTo(raffle.endsAt, now) : null

  return (
    <DeckCard href="/raffles" accent={accent} label="Raffle">
      <div className="mt-6">
        <p className="line-clamp-2 text-[clamp(28px,3.6vw,40px)] font-black leading-[1.02] tracking-[-0.02em] text-white">
          {raffle.prize || raffle.title}
        </p>
        {raffle.prize && <p className="mt-2 truncate text-[14px] text-white/45">{raffle.title}</p>}
      </div>

      {/* The stub, pinned to the bottom so the card lines up with its
          neighbour: a dashed tear line with a notch at each end. */}
      <div className="relative -mx-6 mt-auto pt-7 sm:-mx-7">
        <div className="border-t border-dashed border-white/15" />
        <span className="absolute -left-3 top-4 h-6 w-6 rounded-full bg-[#0B0B0D]" />
        <span className="absolute -right-3 top-4 h-6 w-6 rounded-full bg-[#0B0B0D]" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] text-white/55">
          <Ticket className="h-4 w-4" style={{ color: accent }} />
          {raffle.tickets.toLocaleString("en-US")} {raffle.tickets === 1 ? "ticket" : "tickets"} in
        </span>
        <Chip accent={accent}>{left ? `Draws in ${shortLeft(left, "soon")}` : "Drawing soon"}</Chip>
      </div>
    </DeckCard>
  )
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium"
      style={
        accent
          ? { borderColor: `${accent}55`, backgroundColor: `${accent}14`, color: accent }
          : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }
      }
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Coming up                                  */
/* -------------------------------------------------------------------------- */

/** The next few streams off the schedule, as a row of date cards. */
export function ComingUp({ entries }: { entries: ScheduleEntry[] }) {
  if (entries.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-5 pt-20 lg:px-8">
      <SectionHeading
        eyebrow="Schedule"
        title="Coming up"
        accent={ACCENTS.purple}
        right={<TextLink href="/schedule">Full schedule</TextLink>}
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map((entry) => {
          const date = new Date(entry.starts_at)
          const color = ACCENTS[(entry.color as Accent) ?? "purple"] ?? ACCENTS.purple
          return (
            <Link
              key={entry.id}
              href="/schedule"
              className="group flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.045]"
            >
              <div
                className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2"
                style={{ borderColor: `${color}44`, backgroundColor: `${color}12` }}
              >
                <MonoLabel style={{ color }}>{date.toLocaleDateString("en-US", { weekday: "short" })}</MonoLabel>
                <span className="mt-1 text-[22px] font-black leading-none tabular-nums text-white">{date.getDate()}</span>
              </div>
              <div className="min-w-0 py-0.5">
                <p className="truncate text-[14.5px] font-semibold text-white">{entry.title || "Stream"}</p>
                <p className="mt-1 text-[12.5px] tabular-nums text-white/45">
                  {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  {entry.category ? ` · ${entry.category}` : ""}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Site index                                 */
/* -------------------------------------------------------------------------- */

export type IndexEntry = {
  href: string
  accent: Accent
  title: string
  copy: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

/**
 * Everything on the site, as a numbered index rather than a grid of cards.
 *
 * Six equal tiles read as a menu; a list of large titles reads as a contents
 * page you can scan in one pass. Each row fills with its accent from the left
 * on hover, which is the only place on the page those six colours appear
 * together.
 */
export function SiteIndex({ entries }: { entries: IndexEntry[] }) {
  if (entries.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-5 pt-24 lg:px-8">
      <SectionHeading eyebrow="Explore" title="Everything on the site" accent={ACCENTS.amber} />
      <ol className="mt-8 border-t border-white/[0.08]">
        {entries.map((entry, index) => {
          const color = ACCENTS[entry.accent]
          const Icon = entry.icon
          return (
            <li key={entry.href} className="border-b border-white/[0.08]">
              <Link
                href={entry.href}
                className="group relative grid grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-1 overflow-hidden px-2 py-6 sm:gap-x-8 sm:px-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)_auto]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                  style={{ background: `linear-gradient(90deg, ${color}26, ${color}08 60%, transparent)` }}
                />
                <span className="relative font-mono text-[13px] font-semibold tabular-nums" style={{ color }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="relative flex min-w-0 items-center gap-4">
                  <Icon
                    className="hidden h-6 w-6 shrink-0 transition-transform duration-300 group-hover:scale-110 sm:block"
                    style={{ color }}
                  />
                  <span className="truncate text-[clamp(24px,3.6vw,40px)] font-black uppercase leading-none tracking-[-0.02em] text-white">
                    {entry.title}
                  </span>
                </span>
                <span className="relative col-span-3 col-start-2 row-start-2 text-[13.5px] leading-relaxed text-white/45 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                  {entry.copy}
                </span>
                <span
                  className="relative col-start-3 row-start-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition duration-300 group-hover:-rotate-45 group-hover:border-transparent lg:col-start-4"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ backgroundColor: color }}
                  />
                  <ArrowRight className="relative h-4 w-4 text-white/60 transition group-hover:text-black" />
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*                                How it works                                */
/* -------------------------------------------------------------------------- */

const STEPS = [
  { title: "Watch the stream", copy: "Everything starts on Kick. Being there is the entry — there is nothing to buy." },
  { title: "Take part", copy: "Call the hunt balance, enter a raffle, climb the leaderboard, join a tournament." },
  { title: "Get paid", copy: "Winners are logged and paid out. The log on this site is the one used to settle them." },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-24 lg:px-8">
      <SectionHeading eyebrow="How it works" title="Three steps, no catch" accent={ACCENTS.green} />
      <div className="relative mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-7"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute right-5 top-2 select-none text-[96px] font-black leading-none tabular-nums text-transparent"
              style={{ WebkitTextStroke: "1px rgba(255,255,255,0.08)" }}
            >
              {index + 1}
            </span>
            <span
              className="relative flex h-10 w-10 items-center justify-center rounded-xl font-mono text-[14px] font-bold text-black"
              style={{ backgroundColor: index === 2 ? ACCENTS.green : "rgba(255,255,255,0.85)" }}
            >
              {index + 1}
            </span>
            <h3 className="relative mt-6 text-[20px] font-bold text-white">{step.title}</h3>
            <p className="relative mt-2 text-[14px] leading-relaxed text-white/45">{step.copy}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Kick band                                  */
/* -------------------------------------------------------------------------- */

export function KickBand() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-6 pt-24 lg:px-8">
      <div
        className="relative overflow-hidden rounded-[28px] border p-8 sm:p-12"
        style={{
          borderColor: `${KICK_GREEN}33`,
          background: `radial-gradient(700px 300px at 100% 0%, ${KICK_GREEN}22, transparent 65%), #0C0F0B`,
        }}
      >
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-xl">
            <MonoLabel style={{ color: KICK_GREEN }}>Live on Kick</MonoLabel>
            <h2 className="mt-4 text-[clamp(30px,4.6vw,52px)] font-black uppercase leading-[0.92] tracking-[-0.03em] text-white">
              Giveaways happen
              <br />
              on stream.
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-white/50">
              A keyword drops in chat, the wheel spins live, the winner is paid on the spot. Being there is the whole
              entry.
            </p>
          </div>
          <KickButton size="lg" label="Watch TrinidoSlots" />
        </div>
      </div>
    </section>
  )
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/50 transition hover:text-white"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
    </Link>
  )
}
