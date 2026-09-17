import type { SupabaseClient } from "@supabase/supabase-js"

export type ActiveHunt = {
  id: string
  status: string
  starting_balance: number
  streamer: string
  title: string | null
  created_at: string
  ended_at: string | null
}

/** Row shape of the `bonus_hunt_kpis` view — the single source of truth for
 * live/derived numbers on both the active hunt and any ended hunt. */
export type HuntKpis = {
  hunt_id: string
  status: string
  streamer: string
  title: string | null
  starting_balance: number
  opening_balance: number
  created_at: string
  ended_at: string | null
  total_bonuses: number
  opened_bonuses: number
  remaining: number
  total_won: number
  current_balance: number
  best_multiplier: number
  best_multiplier_game: string | null
  best_cash_win: number
  best_cash_win_game: string | null
  average_multi: number
  average_bet: number
}

/**
 * Single source of truth for "the current hunt". Every page/route that needs
 * the active bonus hunt (public Bonus Hunt page, admin Bonus Hunt page, admin
 * Opening page, the predictions API) should call this instead of querying
 * `bonus_hunts` directly, so they never disagree on which hunt is active.
 */
export async function getActiveHunt(supabase: SupabaseClient): Promise<ActiveHunt | null> {
  const { data, error } = await supabase
    .from("bonus_hunts")
    .select("id, status, starting_balance, streamer, title, created_at, ended_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[v0] getActiveHunt error:", error)
    return null
  }

  return (data as ActiveHunt | null) ?? null
}
