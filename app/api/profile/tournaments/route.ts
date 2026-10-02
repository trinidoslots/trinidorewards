import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { multiplier, roundCount, roundLabel } from "@/lib/tournament"
import type { TournamentResult } from "@/components/profile-tournaments"

/**
 * The signed-in user's bracket tournaments, for the profile's Tournaments tab.
 *
 * The ones they were added to in Admin > Tournaments and linked to their
 * account (tournament_participants.user_id, scripts/087). For each: what they
 * played, every match they were in (opponent, both payouts, who went
 * through), and how far they got.
 */

export const dynamic = "force-dynamic"

type Row = Record<string, unknown>

const num = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = serviceClient()
  const { data: entries, error } = await client
    .from("tournament_participants")
    .select(
      "id, tournament_id, username, buy_amount, casino, game_name, game_image_url, is_super, joined_at, tournaments(id, title, bracket_size, bracket_status, started_at, finished_at, champion_participant_id, created_at)",
    )
    .eq("user_id", session.userId)
    .order("joined_at", { ascending: false })
    .limit(50)

  if (error) {
    // Before scripts/087 there is no user_id to look for: nothing linked yet.
    if (["42703", "PGRST204"].includes(error.code ?? "")) return NextResponse.json({ results: [] })
    console.error("[profile] tournaments:", error)
    return NextResponse.json({ error: "Could not load your tournaments." }, { status: 500 })
  }

  const mine = ((entries ?? []) as Row[]).filter((entry) => entry.tournaments)
  if (mine.length === 0) return NextResponse.json({ results: [] })

  const myIds = mine.map((entry) => String(entry.id))
  const tournamentIds = mine.map((entry) => String(entry.tournament_id))

  // Their matches, and everyone in those tournaments (for the opponents' names and buys).
  const [{ data: matches }, { data: players }] = await Promise.all([
    client
      .from("tournament_matches")
      .select("id, tournament_id, round_number, match_number, p1_id, p2_id, p1_payout, p2_payout, winner_participant_id")
      .in("tournament_id", tournamentIds)
      .order("round_number"),
    client
      .from("tournament_participants")
      .select("id, username, buy_amount, game_name, game_image_url")
      .in("tournament_id", tournamentIds),
  ])

  const playerById = new Map(((players ?? []) as Row[]).map((player) => [String(player.id), player]))
  const results: TournamentResult[] = []

  for (const entry of mine) {
    const tournament = entry.tournaments as Row
    const me = String(entry.id)
    const size = num(tournament.bracket_size) ?? 0
    const rounds = size > 1 ? roundCount(size) : 0
    const buy = num(entry.buy_amount) ?? 0
    const status = tournament.bracket_status === "finished" ? "finished" : tournament.bracket_status === "running" ? "running" : "registration"

    const played = ((matches ?? []) as Row[])
      .filter((match) => String(match.tournament_id) === String(entry.tournament_id))
      .filter((match) => String(match.p1_id) === me || String(match.p2_id) === me)
      .map((match) => {
        const side = String(match.p1_id) === me ? 1 : 2
        const opponentId = side === 1 ? match.p2_id : match.p1_id
        const opponent = opponentId ? playerById.get(String(opponentId)) : undefined
        const myPayout = num(side === 1 ? match.p1_payout : match.p2_payout)
        const theirPayout = num(side === 1 ? match.p2_payout : match.p1_payout)
        const winner = match.winner_participant_id ? String(match.winner_participant_id) : null
        const round = num(match.round_number) ?? 1
        return {
          round,
          roundName: size > 1 ? roundLabel(round, size) : `Round ${round}`,
          opponent: opponent
            ? {
                username: String(opponent.username),
                game: (opponent.game_name as string | null) ?? null,
                buy: num(opponent.buy_amount) ?? 0,
              }
            : null,
          myPayout,
          theirPayout,
          myMulti: multiplier(myPayout, buy),
          theirMulti: opponent ? multiplier(theirPayout, num(opponent.buy_amount) ?? 0) : null,
          result: winner ? (winner === me ? "won" : "lost") : "pending",
        } as TournamentResult["matches"][number]
      })
      .sort((a, b) => a.round - b.round)

    const won = played.filter((match) => match.result === "won").length
    const lostIn = played.find((match) => match.result === "lost")
    const champion = String(tournament.champion_participant_id ?? "") === me
    const outcome: TournamentResult["outcome"] = champion
      ? "champion"
      : lostIn
        ? lostIn.round === rounds
          ? "runner_up"
          : "out"
        : status === "registration"
          ? "waiting"
          : status === "finished"
            ? "out"
            : "playing"
    const multis = played.map((match) => match.myMulti).filter((value): value is number => value != null)

    results.push({
      id: me,
      tournamentId: String(entry.tournament_id),
      title: String(tournament.title ?? "Tournament"),
      size,
      status,
      date: String(tournament.started_at ?? entry.joined_at ?? tournament.created_at ?? ""),
      finishedAt: (tournament.finished_at as string | null) ?? null,
      game: (entry.game_name as string | null) ?? null,
      gameImage: (entry.game_image_url as string | null) ?? null,
      buy,
      casino: (entry.casino as string | null) ?? null,
      isSuper: entry.is_super === true,
      outcome,
      outRound: lostIn ? lostIn.roundName : null,
      matchesWon: won,
      bestMulti: multis.length ? Math.max(...multis) : null,
      matches: played,
    })
  }

  return NextResponse.json({ results })
}
