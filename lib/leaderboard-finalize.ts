import { rankEntries } from "@/lib/leaderboard-payouts"
import { entryAmounts, readMetric } from "@/lib/leaderboard-metric"

/**
 * Closing a leaderboard.
 *
 * A board whose window has passed is only half-done: the standings still sort
 * live off the wagers, so a late CSV import or an API refresh could still
 * reshuffle who "won" after the fact. Finalising writes the ranks and prizes
 * once, stamps finalized_at, and from then on the row is the record of who won
 * and what they were owed.
 *
 * Deliberately separate from `credited`, which records that the money actually
 * moved — that stays a human decision.
 */

type SupabaseLike = {
  from: (table: string) => any
}

export type FinalizeResult = {
  leaderboardId: string
  title: string
  entries: number
  totalPrize: number
}

/** Freezes one board. Safe to call twice — a finalised board is skipped. */
export async function finalizeLeaderboard(
  supabase: SupabaseLike,
  leaderboardId: string,
  options: { force?: boolean } = {},
): Promise<FinalizeResult | null> {
  const { data: board, error: boardError } = await supabase
    .from("leaderboards")
    .select("*")
    .eq("id", leaderboardId)
    .maybeSingle()

  if (boardError || !board) {
    console.error("[v0] finalize: leaderboard not found", leaderboardId, boardError)
    return null
  }
  if (board.finalized_at && !options.force) return null

  const { data: entries, error: entriesError } = await supabase
    .from("leaderboard_entries")
    .select("*")
    .eq("leaderboard_id", leaderboardId)

  if (entriesError) {
    console.error("[v0] finalize: could not read entries", leaderboardId, entriesError)
    return null
  }

  const preset = board.payout_preset ?? board.prize_distribution_type
  const metric = readMetric(board.ranking_metric)

  // The frozen ranks must come out of the same comparison the public page
  // showed all month, so the metric is read from the board rather than assumed.
  const amounts: { id: string; total_wagered: number; total_earned: number }[] = (entries ?? []).map(
    (entry: Record<string, unknown>) => ({
      id: String(entry.id),
      ...entryAmounts(entry),
    }),
  )
  const ranked = rankEntries(amounts, Number(board.prize_pool) || 0, preset, metric)

  // Written one row at a time: the ranks are derived from the whole field, so
  // there is no single-statement update that expresses this.
  for (const entry of ranked) {
    const { error } = await supabase
      .from("leaderboard_entries")
      .update({ rank: entry.rank, prize_amount: entry.prize_amount })
      .eq("id", entry.id)
    if (error) console.error("[v0] finalize: could not freeze entry", entry, error)
  }

  const totalPrize = ranked.reduce((sum, entry) => sum + entry.prize_amount, 0)

  const { error: stampError } = await supabase
    .from("leaderboards")
    .update({ status: "ended", finalized_at: new Date().toISOString() })
    .eq("id", leaderboardId)
  if (stampError) console.error("[v0] finalize: could not stamp board", leaderboardId, stampError)

  return { leaderboardId, title: board.title, entries: ranked.length, totalPrize }
}

/**
 * Finalises every board whose window has closed and that has not been frozen
 * yet. Driven by the cron route; also safe to trigger by hand from the admin.
 */
export async function finalizeDueLeaderboards(supabase: SupabaseLike): Promise<FinalizeResult[]> {
  const { data: due, error } = await supabase
    .from("leaderboards")
    .select("id")
    .is("finalized_at", null)
    .lt("end_date", new Date().toISOString())

  if (error) {
    console.error("[v0] finalize: could not list due leaderboards", error)
    return []
  }

  const results: FinalizeResult[] = []
  for (const board of due ?? []) {
    const result = await finalizeLeaderboard(supabase, board.id)
    if (result) results.push(result)
  }
  return results
}
