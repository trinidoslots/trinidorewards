import { createServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import TournamentBracketView from "@/components/tournament-bracket-view"

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient()

  const { data: tournament } = await supabase.from("tournaments").select("*").eq("id", params.id).single()

  if (!tournament) {
    notFound()
  }

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", params.id)
    .order("round_number")
    .order("match_number")

  return <TournamentBracketView tournament={tournament} matches={matches || []} />
}
