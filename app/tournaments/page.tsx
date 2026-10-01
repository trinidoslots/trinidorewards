import { ACCENTS } from "@/components/ui/panel"
import { createServerClient } from "@/lib/supabase/server"
import { PageBody, PageHero } from "@/components/page-hero"
import { SectionHeading } from "@/components/landing/parts"
import {
  FeatureTournament,
  FinishedTournamentRow,
  NothingRunning,
  TournamentCard,
  type TournamentEntry,
} from "@/components/tournament-cards"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tournaments",
}

/**
 * Tournaments, as the audience sees them.
 *
 * Player counts come off the tournament row. This page used to read every
 * participant row on every load to add them up; scripts/049 backfilled
 * current_participants and the console keeps it current.
 */

/**
 * Re-fetched at most this often. Nothing here is per-visitor, so serving the
 * same render to everyone for half a minute turns a query per page view into a
 * query every 30 seconds.
 */
export const revalidate = 30

type Tournament = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  prize_pool: number | null
  max_participants: number | null
  bracket_size: number | null
  bracket_status: string | null
  current_participants: number | null
  tournament_type: string | null
  status: string
  start_date: string
  end_date: string
  winner_username: string | null
  featured: boolean
}

async function fetchAll() {
  const supabase = await createServerClient()

  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("*")
    // A reset that could not delete its row leaves it cancelled; see the admin page.
    .neq("status", "cancelled")
    .order("featured", { ascending: false })
    .order("start_date", { ascending: false })

  if (error) console.error("[v0] Error fetching tournaments:", error)

  return { tournaments: (tournaments ?? []) as Tournament[] }
}

/** Battles run through the console carry their own lifecycle column. */
function phaseOf(tournament: Tournament): "registration" | "running" | "finished" {
  if (tournament.bracket_status) {
    if (tournament.bracket_status === "finished") return "finished"
    if (tournament.bracket_status === "running") return "running"
    return "registration"
  }
  if (tournament.status === "completed") return "finished"
  if (tournament.status === "registration" || tournament.status === "upcoming") return "registration"
  return "running"
}

export default async function TournamentsPage() {
  const { tournaments } = await fetchAll()

  const rows: TournamentEntry[] = tournaments.map((tournament) => ({
    tournament,
    players: Number(tournament.current_participants) || 0,
    phase: phaseOf(tournament),
  }))

  const live = rows.filter((row) => row.phase === "running")
  const open = rows.filter((row) => row.phase === "registration")
  const done = rows.filter((row) => row.phase === "finished")

  const totalPrize = tournaments.reduce((sum, tournament) => sum + (Number(tournament.prize_pool) || 0), 0)

  const [featured, ...moreLive] = live

  return (
    <div>
      <PageHero
        accent="purple"
        title="Tournaments"
        subtitle="Bonus battles, bracket by bracket."
        note={
          live.length > 0
            ? `${live.length} live now`
            : open.length > 0
              ? `${open.length} taking entries`
              : "Between brackets"
        }
        figure={totalPrize > 0 ? `$${Math.round(totalPrize).toLocaleString("en-US")}` : undefined}
        figureLabel="In prize pools"
      />
      <PageBody className="space-y-16">
        <section className="space-y-6">
          <SectionHeading eyebrow="Live" title="Running now" accent={ACCENTS.green} />
          {featured ? (
            <>
              <FeatureTournament entry={featured} />
              {moreLive.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {moreLive.map((entry) => (
                    <TournamentCard key={entry.tournament.id} entry={entry} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <NothingRunning />
          )}
        </section>

        {open.length > 0 && (
          <section className="space-y-6">
            <SectionHeading eyebrow="Sign-ups" title="Taking entries" accent={ACCENTS.blue} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {open.map((entry) => (
                <TournamentCard key={entry.tournament.id} entry={entry} />
              ))}
            </div>
          </section>
        )}

        {done.length > 0 && (
          <section className="space-y-6">
            <SectionHeading eyebrow="Archive" title="Finished" accent={ACCENTS.slate} />
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12]">
              {done.map((entry) => (
                <FinishedTournamentRow key={entry.tournament.id} entry={entry} />
              ))}
            </div>
          </section>
        )}
      </PageBody>
    </div>
  )
}
