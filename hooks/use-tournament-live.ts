"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Match, Participant } from "@/lib/tournament"

export type LiveTournament = {
  id: string
  title: string
  bracket_size: number | null
  bracket_status: string | null
  started_at: string | null
  finished_at: string | null
  champion_participant_id: string | null
  winner_username: string | null
  created_at: string
}

export type TournamentSnapshot = {
  tournament: LiveTournament | null
  participants: Participant[]
  matches: Match[]
  loading: boolean
}

const TOURNAMENT_COLUMNS =
  "id, title, bracket_size, bracket_status, started_at, finished_at, champion_participant_id, winner_username, created_at"
const PARTICIPANT_COLUMNS =
  "id, username, buy_amount, casino, game_name, game_image_url, is_super, seed, joined_at"
const MATCH_COLUMNS =
  "id, round_number, match_number, p1_id, p2_id, p1_payout, p2_payout, winner_participant_id, played_at"

/**
 * One tournament, kept current.
 *
 * Shared by the public page and both OBS sources so they cannot disagree about
 * what is on screen. Realtime drives it, with a poller behind it: a new table
 * is not in the supabase_realtime publication until a migration puts it there,
 * and an overlay that silently stops updating mid-stream is the worst possible
 * failure here.
 *
 * With no `id`, it follows the newest bonus battle — including one that has
 * just finished, so the champion stays up after the final instead of the
 * overlay going blank the moment it is decided.
 */
export function useTournamentLive({
  id,
  pollMs = 5_000,
  enabled = true,
}: { id?: string; pollMs?: number; enabled?: boolean } = {}): TournamentSnapshot {
  const [snapshot, setSnapshot] = useState<TournamentSnapshot>({
    tournament: null,
    participants: [],
    matches: [],
    loading: true,
  })
  const supabaseRef = useRef(createClient())

  const fetchAll = useCallback(async () => {
    if (!enabled) return
    const supabase = supabaseRef.current

    const query = supabase.from("tournaments").select(TOURNAMENT_COLUMNS)
    const { data: row, error } = id
      ? await query.eq("id", id).maybeSingle()
      : await query.eq("tournament_type", "battle").order("created_at", { ascending: false }).limit(1).maybeSingle()

    if (error) {
      console.error("[v0] Could not load the tournament:", error)
      setSnapshot((current) => ({ ...current, loading: false }))
      return
    }
    if (!row) {
      setSnapshot({ tournament: null, participants: [], matches: [], loading: false })
      return
    }

    const [{ data: people }, { data: games }] = await Promise.all([
      supabase
        .from("tournament_participants")
        .select(PARTICIPANT_COLUMNS)
        .eq("tournament_id", row.id)
        .order("joined_at"),
      supabase
        .from("tournament_matches")
        .select(MATCH_COLUMNS)
        .eq("tournament_id", row.id)
        .order("round_number")
        .order("match_number"),
    ])

    setSnapshot({
      tournament: row as LiveTournament,
      participants: (people ?? []) as Participant[],
      matches: (games ?? []) as Match[],
      loading: false,
    })
  }, [id, enabled])

  useEffect(() => {
    // Preview mode supplies its own fixture; there is nothing to subscribe to,
    // and polling a database every five seconds to discard the answer is worse
    // than useless when the source is sitting open in OBS.
    if (!enabled) return
    fetchAll()

    const supabase = supabaseRef.current
    const channel = supabase
      .channel("tournament_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_participants" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches" }, fetchAll)
      .subscribe()

    // The payload is ignored on purpose: a match update changes who is in the
    // next match too, so refetching is both simpler and correct.
    const poll = setInterval(fetchAll, pollMs)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [fetchAll, pollMs, enabled])

  return snapshot
}

/**
 * The match that is being opened right now: the first one where both players
 * are known and no winner has been entered. Returns null once the bracket is
 * played out.
 */
export function currentMatch(matches: Match[]): Match | null {
  return (
    [...matches]
      .sort((a, b) => a.round_number - b.round_number || a.match_number - b.match_number)
      .find((match) => match.p1_id && match.p2_id && !match.winner_participant_id) ?? null
  )
}
