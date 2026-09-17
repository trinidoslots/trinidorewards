import Link from "next/link"
import { Swords, Trophy, Users } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"

/**
 * Tournaments, as the audience sees them.
 *
 * Counts come from the participants rather than tournaments.current_participants,
 * which nothing maintains — the console writes participant rows and never that
 * column, so it reads zero for every battle it created.
 */

type Tournament = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  prize_pool: number | null
  max_participants: number | null
  bracket_size: number | null
  bracket_status: string | null
  tournament_type: string | null
  status: string
  start_date: string
  end_date: string
  winner_username: string | null
  featured: boolean
}

const money = (value: number) => "$" + Math.round(Number(value) || 0).toLocaleString("en-US")

async function fetchAll() {
  const supabase = await createServerClient()

  const [{ data: tournaments, error }, { data: participants }] = await Promise.all([
    supabase.from("tournaments").select("*").order("featured", { ascending: false }).order("start_date", { ascending: false }),
    supabase.from("tournament_participants").select("tournament_id"),
  ])

  if (error) console.error("[v0] Error fetching tournaments:", error)

  const counts = new Map<string, number>()
  for (const row of participants ?? []) {
    counts.set(row.tournament_id, (counts.get(row.tournament_id) ?? 0) + 1)
  }

  return { tournaments: (tournaments ?? []) as Tournament[], counts }
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
  const { tournaments, counts } = await fetchAll()

  const rows = tournaments.map((tournament) => ({
    tournament,
    players: counts.get(tournament.id) ?? 0,
    phase: phaseOf(tournament),
  }))

  const live = rows.filter((row) => row.phase === "running")
  const open = rows.filter((row) => row.phase === "registration")
  const done = rows.filter((row) => row.phase === "finished")

  const totalPrize = tournaments.reduce((sum, tournament) => sum + (Number(tournament.prize_pool) || 0), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Tournaments</h1>
        <p className="mt-1 text-[13px] text-white/40">Bonus battles, bracket by bracket.</p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Running now" value={live.length.toLocaleString()} accent="green" />
        <StatTile label="Taking entries" value={open.length.toLocaleString()} accent="blue" />
        <StatTile label="Prize pool listed" value={money(totalPrize)} accent="amber" />
      </div>

      <Section title="Running now" rows={live} empty="Nothing is being played right now." />
      <Section title="Taking entries" rows={open} empty={null} />
      <Section title="Finished" rows={done} empty={null} />
    </div>
  )
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string
  rows: { tournament: Tournament; players: number; phase: string }[]
  empty: string | null
}) {
  if (rows.length === 0 && !empty) return null

  return (
    <section className="space-y-2.5">
      <MonoLabel className="text-white/30">{title}</MonoLabel>
      {rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 py-12">
          <Swords className="h-7 w-7 text-white/10" />
          <p className="text-[13px] text-white/30">{empty}</p>
        </Panel>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <TournamentCard key={row.tournament.id} {...row} />
          ))}
        </div>
      )}
    </section>
  )
}

function TournamentCard({
  tournament,
  players,
  phase,
}: {
  tournament: Tournament
  players: number
  phase: string
}) {
  const size = Number(tournament.bracket_size) || Number(tournament.max_participants) || 0
  const filled = size > 0 ? Math.min(100, (players / size) * 100) : 0
  const accent = phase === "running" ? "green" : phase === "registration" ? "blue" : "slate"

  return (
    <Link href={"/tournaments/" + tournament.id} className="block">
      <Panel accent={accent} className="h-full overflow-hidden transition hover:border-white/20">
        <div className="relative">
          {tournament.image_url ? (
            <img src={tournament.image_url} alt="" className="h-32 w-full object-cover" />
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-white/[0.02]">
              <Swords className="h-9 w-9 text-white/10" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Tag accent={accent}>{phase}</Tag>
            {tournament.featured && <Tag accent="amber">Featured</Tag>}
          </div>
        </div>

        <div className="space-y-2 p-3.5">
          <div>
            <h3 className="truncate text-[14px] font-semibold text-white">{tournament.title}</h3>
            {tournament.description && (
              <p className="line-clamp-2 text-[12px] text-white/35">{tournament.description}</p>
            )}
          </div>

          {tournament.winner_username && (
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.amber }} />
              <span className="truncate text-[12.5px] text-white/70">{tournament.winner_username}</span>
            </div>
          )}

          {size > 0 && (
            <div>
              <div className="flex items-baseline justify-between">
                <MonoLabel className="text-white/25">
                  {players} / {size} players
                </MonoLabel>
                <MonoLabel className="text-white/25">{Math.round(filled)}%</MonoLabel>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full" style={{ width: filled + "%", backgroundColor: ACCENTS[accent] }} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-white/[0.06] pt-2">
            <span className="flex items-center gap-1.5 text-[12px] text-white/40">
              <Users className="h-3 w-3" />
              {players}
            </span>
            {tournament.prize_pool ? (
              <span className="ml-auto text-[13px] font-semibold" style={{ color: ACCENTS.amber }}>
                {money(tournament.prize_pool)}
              </span>
            ) : (
              <MonoLabel className="ml-auto text-white/20">
                {new Date(tournament.start_date).toLocaleDateString()}
              </MonoLabel>
            )}
          </div>
        </div>
      </Panel>
    </Link>
  )
}
