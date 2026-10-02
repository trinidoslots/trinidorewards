import { serviceClient } from "@/lib/supabase/service"
import { botPointsRaffleEnded } from "@/lib/kick-bot/announce"

/**
 * Points raffles (scripts/089): a keyword typed in Kick chat within a time
 * window enters you; when the time is up the database draws the winners and
 * pays them (draw_points_raffle). The chat webhook collects the entries and
 * notices when time is up; the admin page does too while it is open.
 */

export const MAX_RAFFLE_MINUTES = 120
export const MAX_RAFFLE_WINNERS = 100
export const MAX_RAFFLE_POINTS = 1_000_000

export type PointsRaffle = {
  id: string
  keyword: string
  points_each: number
  winner_count: number
  starts_at: string
  ends_at: string
  status: "open" | "drawn" | "cancelled"
  created_by: string | null
  drawn_at: string | null
  entry_count: number | null
  eligible_count: number | null
  winners: { username: string; kick_id: string; user_id: string }[]
  created_at: string
}

/** Same rule as the Kick giveaway: the whole message, trimmed, any case. */
export function matchesKeyword(content: string, keyword: string): boolean {
  const wanted = keyword.trim().toLowerCase()
  return wanted.length > 0 && content.trim().toLowerCase() === wanted
}

/**
 * Draws the raffle if its time is up (or now, with force), then has the bot
 * announce it. Safe to call from several places at once: the database draws
 * once and the announcement is claimed once.
 */
export async function drawPointsRaffle(raffleId: string, force = false): Promise<PointsRaffle | null> {
  const { data, error } = await serviceClient().rpc("draw_points_raffle", { p_raffle_id: raffleId, p_force: force })
  if (error) throw new Error(`draw_points_raffle: ${error.message}`)
  const raffle = data as (PointsRaffle & { already?: boolean; too_early?: boolean }) | null
  if (!raffle) return null
  if (raffle.status === "drawn") await botPointsRaffleEnded(raffle.id)
  return raffle
}

/** Draws every open raffle whose time has run out. Returns how many it drew. */
export async function drawExpiredPointsRaffles(): Promise<number> {
  const { data } = await serviceClient()
    .from("points_raffles")
    .select("id")
    .eq("status", "open")
    .lte("ends_at", new Date().toISOString())
  for (const raffle of data ?? []) await drawPointsRaffle(raffle.id)
  return data?.length ?? 0
}

/**
 * One chat message against the open raffle: enters the sender when it is the
 * keyword and the raffle is still running, or draws it when its time is up.
 */
export async function enterPointsRaffle(message: {
  kickId: string | null
  username: string
  content: string
  sentAt: string
}): Promise<{ drawId: string | null }> {
  const client = serviceClient()
  const { data: open, error } = await client
    .from("points_raffles")
    .select("id, keyword, ends_at")
    .eq("status", "open")
    .maybeSingle()
  // Before scripts/089 the table is missing; chat must keep working regardless.
  if (error || !open) return { drawId: null }

  const endsAt = Date.parse(open.ends_at)
  if (endsAt <= Date.now()) return { drawId: open.id }

  if (message.kickId && Date.parse(message.sentAt) < endsAt && matchesKeyword(message.content, open.keyword)) {
    const { error: entryError } = await client
      .from("points_raffle_entries")
      .upsert(
        { raffle_id: open.id, kick_id: message.kickId, username: message.username.slice(0, 64) },
        { onConflict: "raffle_id,kick_id", ignoreDuplicates: true },
      )
    if (entryError) console.error("[points-raffle] entry not saved:", entryError)
  }
  return { drawId: null }
}
