import type React from "react"
import Link from "next/link"
import { ArrowRight, Crown, Swords, Users } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { ArtImage } from "@/components/art-image"

/**
 * The pieces of the tournaments page — the raffles page's shapes, for brackets.
 * Plain props only, so they render the same in the cached server page and
 * anywhere else.
 */

export type TournamentCardData = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  prize_pool: number | null
  max_participants: number | null
  bracket_size: number | null
  start_date: string
  winner_username: string | null
  featured: boolean
}

export type TournamentPhase = "registration" | "running" | "finished"

export type TournamentEntry = { tournament: TournamentCardData; players: number; phase: TournamentPhase }

const money = (value: number) => "$" + Math.round(Number(value) || 0).toLocaleString("en-US")

const PHASE: Record<TournamentPhase, { label: string; accent: Accent }> = {
  running: { label: "Live", accent: "green" },
  registration: { label: "Taking entries", accent: "blue" },
  finished: { label: "Finished", accent: "slate" },
}

function sizeOf(tournament: TournamentCardData) {
  return Number(tournament.bracket_size) || Number(tournament.max_participants) || 0
}

function Chip({ children, accent }: { children: React.ReactNode; accent: Accent }) {
  const color = ACCENTS[accent]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}26`, color }}
    >
      {children}
    </span>
  )
}

function Chips({ entry }: { entry: TournamentEntry }) {
  const meta = PHASE[entry.phase]
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip accent={meta.accent}>
        {entry.phase === "running" && (
          <span className="relative mr-0.5 flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
        )}
        {meta.label}
      </Chip>
      {entry.tournament.featured && <Chip accent="amber">Featured</Chip>}
    </div>
  )
}

/** Players against the bracket size. */
function FieldBar({ players, size, accent }: { players: number; size: number; accent: string }) {
  if (size <= 0) return null
  const filled = Math.min(100, (players / size) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <MonoLabel className="text-white/40">
          {players} / {size} players
        </MonoLabel>
        <MonoLabel className="text-white/40">{Math.round(filled)}%</MonoLabel>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${filled}%`, backgroundColor: accent }} />
      </div>
    </div>
  )
}

function Prize({ tournament }: { tournament: TournamentCardData }) {
  return tournament.prize_pool ? (
    <span className="text-[15px] font-bold tabular-nums" style={{ color: ACCENTS.amber }}>
      {money(tournament.prize_pool)}
    </span>
  ) : (
    <MonoLabel className="text-white/40">{new Date(tournament.start_date).toLocaleDateString()}</MonoLabel>
  )
}

/** The bracket being played right now, at full width. */
export function FeatureTournament({ entry }: { entry: TournamentEntry }) {
  const { tournament, players } = entry
  const accent = ACCENTS.green

  return (
    // The wrapper is what the card measures its corners against; see
    // FeatureRaffle in raffle-cards.tsx for the arithmetic.
    <div className="@container">
      <Link
        href={`/tournaments/${tournament.id}`}
        className="group relative grid overflow-hidden rounded-[3.2cqw] border border-white/[0.10] bg-[#0E0E12] transition duration-300 hover:border-white/20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:rounded-[1.68cqw]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
          style={{ backgroundColor: accent }}
        />
        <div className="relative flex items-center border-b border-white/[0.07] lg:border-b-0 lg:border-r">
          <ArtImage src={tournament.image_url} className="w-full" icon={Swords} />
        </div>

        <div className="relative flex flex-col gap-6 p-6 sm:p-8">
          <div>
            <Chips entry={entry} />
            <h3 className="mt-5 text-[clamp(26px,3.4vw,38px)] font-black uppercase leading-[0.95] tracking-[-0.01em] text-white">
              {tournament.title}
            </h3>
            {tournament.description && (
              <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-white/50">{tournament.description}</p>
            )}
          </div>

          <FieldBar players={players} size={sizeOf(tournament)} accent={accent} />

          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/[0.07] pt-5">
            <span className="flex items-center gap-1.5 text-[13px] text-white/50">
              <Users className="h-4 w-4" /> {players}
            </span>
            <Prize tournament={tournament} />
            <span
              className="ml-auto inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[14px] font-bold text-black transition group-hover:brightness-110"
              style={{ backgroundColor: accent }}
            >
              Follow the bracket <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}

/** Any other tournament still to finish. */
export function TournamentCard({ entry }: { entry: TournamentEntry }) {
  const { tournament, players, phase } = entry
  const accent = ACCENTS[PHASE[phase].accent]

  return (
    <div className="@container flex">
      <Link
        href={`/tournaments/${tournament.id}`}
        className="group relative flex w-full flex-col overflow-hidden rounded-[3.2cqw] border border-white/[0.08] bg-[#0E0E12] transition duration-300 hover:-translate-y-1 hover:border-white/20"
      >
        <ArtImage src={tournament.image_url} icon={Swords} />
        <div className="flex flex-1 flex-col gap-4 p-5">
          <Chips entry={entry} />
          <div>
            <h3 className="truncate text-[17px] font-bold text-white">{tournament.title}</h3>
            {tournament.description && (
              <p className="mt-0.5 line-clamp-2 text-[13px] text-white/45">{tournament.description}</p>
            )}
          </div>
          <FieldBar players={players} size={sizeOf(tournament)} accent={accent} />
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <span className="flex items-center gap-1.5 text-[13px] text-white/50">
              <Users className="h-4 w-4" /> {players}
            </span>
            <Prize tournament={tournament} />
          </div>
        </div>
      </Link>
    </div>
  )
}

/** A finished tournament: one row, with its champion. */
export function FinishedTournamentRow({ entry }: { entry: TournamentEntry }) {
  const { tournament, players } = entry
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,14rem)_auto] sm:px-6"
    >
      <ArtImage src={tournament.image_url} inset={false} icon={Swords} />
      <div className="min-w-0">
        <p className="truncate text-[14.5px] font-semibold text-white">{tournament.title}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-white/40">
          {players} {players === 1 ? "player" : "players"}
          {tournament.prize_pool ? ` · ${money(tournament.prize_pool)}` : ""}
        </p>
      </div>
      <div className="col-span-2 col-start-2 flex min-w-0 items-center gap-2 sm:col-span-1 sm:col-start-auto">
        {tournament.winner_username ? (
          <>
            <Crown className="h-4 w-4 shrink-0" style={{ color: "#F5C542" }} />
            <span className="truncate text-[13.5px] font-semibold text-white/85">{tournament.winner_username}</span>
          </>
        ) : (
          <MonoLabel className="text-white/35">No champion recorded</MonoLabel>
        )}
      </div>
      <span className="hidden text-right sm:block">
        <MonoLabel className="text-white/35">{new Date(tournament.start_date).toLocaleDateString()}</MonoLabel>
      </span>
    </Link>
  )
}

/** Nothing being played: one plain line, since the other sections still follow. */
export function NothingRunning() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${ACCENTS.purple}44`, backgroundColor: `${ACCENTS.purple}14` }}
      >
        <Swords className="h-5 w-5" style={{ color: ACCENTS.purple }} />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-white">Nothing is being played right now</p>
        <p className="mt-0.5 text-[13px] text-white/45">A bracket shows up here as soon as it starts.</p>
      </div>
    </div>
  )
}
