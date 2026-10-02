import { serviceClient } from "@/lib/supabase/service"
import { SITE_URL } from "@/lib/discord/config"
import { claimOnce, getValue, releaseOnce, setValue } from "@/lib/discord/state"
import { maskUsername } from "@/lib/leaderboard-mask"
import { money } from "@/lib/leaderboard-format"
import { botConnection, sendBotMessage } from "@/lib/kick-bot/client"

/**
 * The site telling Kick chat about itself, as @TrinidoRewards.
 *
 * Built like lib/discord/site.ts: every function takes an id, reads the row
 * itself, posts a given thing once however often it is called, and never
 * throws — a raffle is created whether or not Kick took the message.
 */

export const BOT_EVENTS = [
  { id: "raffle.created", label: "Raffle opened" },
  { id: "raffle.ended", label: "Raffle winner" },
  { id: "tournament.open", label: "Tournament opened" },
  { id: "tournament.winner", label: "Tournament winner" },
  { id: "points.given", label: "Points given to chat" },
  { id: "predictions.open", label: "Predictions opened" },
  { id: "predictions.closed", label: "Predictions closed" },
  { id: "leaderboard.created", label: "Leaderboard started" },
  { id: "leaderboard.ended", label: "Leaderboard winners" },
] as const

export type BotEvent = (typeof BOT_EVENTS)[number]["id"]

const EVENTS_KEY = "kick-bot-events"

/** Which announcements are on. Everything is, until switched off on the Kick bot page. */
export async function botEvents(): Promise<Record<BotEvent, boolean>> {
  const stored = (await getValue<Partial<Record<BotEvent, boolean>>>(EVENTS_KEY).catch(() => null)) ?? {}
  return Object.fromEntries(BOT_EVENTS.map(({ id }) => [id, stored[id] !== false])) as Record<BotEvent, boolean>
}

export async function saveBotEvents(next: Partial<Record<string, unknown>>) {
  const current = await botEvents()
  const merged = Object.fromEntries(
    BOT_EVENTS.map(({ id }) => [id, typeof next[id] === "boolean" ? (next[id] as boolean) : current[id]]),
  )
  await setValue(EVENTS_KEY, merged)
  return merged as Record<BotEvent, boolean>
}

async function once(event: BotEvent, key: string, build: () => Promise<string | null>): Promise<void> {
  try {
    // Checked before the claim: a message skipped because the bot was off or
    // not connected yet is not "done", and must not block a later attempt.
    if (!(await botEvents())[event]) return
    if (!(await botConnection()).connected) return
    if (!(await claimOnce(`kick-bot:${key}`))) return
    try {
      const text = await build()
      if (text) await sendBotMessage(text)
    } catch (problem) {
      await releaseOnce(`kick-bot:${key}`)
      throw problem
    }
  } catch (problem) {
    console.error(`[kick-bot] ${key} not posted:`, problem)
  }
}

function rafflePrize(raffle: { prize_name?: string | null; prize_value?: number | null; prize_type?: string | null }) {
  const value = Number(raffle.prize_value) || 0
  if (raffle.prize_type === "points" && value > 0) return `${value.toLocaleString("en-US")} points`
  if (raffle.prize_type === "cash" && value > 0) return raffle.prize_name ? `${raffle.prize_name} (${money(value)})` : money(value)
  return raffle.prize_name || null
}

export function botRaffleCreated(raffleId: string) {
  return once("raffle.created", `raffle-created:${raffleId}`, async () => {
    const { data: raffle } = await serviceClient()
      .from("raffles")
      .select("id, title, prize_name, prize_value, prize_type, entry_type, ticket_price")
      .eq("id", raffleId)
      .maybeSingle()
    if (!raffle) return null
    const prize = rafflePrize(raffle)
    const cost = raffle.entry_type === "points" && Number(raffle.ticket_price) > 0 ? `${raffle.ticket_price} points per ticket` : "free entry"
    return `🎟️ New raffle: ${raffle.title}${prize ? ` – prize: ${prize}` : ""} (${cost}). Enter at ${SITE_URL}/raffles/${raffle.id}`
  })
}

export function botRaffleWinner(raffleId: string) {
  return once("raffle.ended", `raffle-ended:${raffleId}`, async () => {
    const { data: raffle } = await serviceClient()
      .from("raffles")
      .select("id, title, prize_name, prize_value, prize_type, winner_username")
      .eq("id", raffleId)
      .maybeSingle()
    if (!raffle?.winner_username) return null
    const prize = rafflePrize(raffle)
    return `🏆 Raffle "${raffle.title}" is drawn – the winner is @${raffle.winner_username}${prize ? ` (${prize})` : ""}! Congrats!`
  })
}

export function botTournamentOpen(tournamentId: string) {
  return once("tournament.open", `tournament-open:${tournamentId}`, async () => {
    const { data: tournament } = await serviceClient()
      .from("tournaments")
      .select("id, title, bracket_size, max_participants")
      .eq("id", tournamentId)
      .maybeSingle()
    if (!tournament) return null
    const size = Number(tournament.bracket_size ?? tournament.max_participants) || null
    return `⚔️ ${tournament.title} is open${size ? ` – ${size} players` : ""}! Follow the bracket at ${SITE_URL}/tournaments/${tournament.id}`
  })
}

export function botTournamentWinner(tournamentId: string) {
  return once("tournament.winner", `tournament-winner:${tournamentId}`, async () => {
    const { data: tournament } = await serviceClient()
      .from("tournaments")
      .select("id, title, winner_username")
      .eq("id", tournamentId)
      .maybeSingle()
    if (!tournament?.winner_username) return null
    return `👑 ${tournament.title} is over – @${tournament.winner_username} takes the win! GG`
  })
}

export function botPointsGiven(grant: { grantId: string; userCount: number; pointsEach: number; windowMinutes: number }) {
  return once("points.given", `points:${grant.grantId}`, async () => {
    if (grant.userCount <= 0) return null
    const people = grant.userCount === 1 ? "1 chatter" : `${grant.userCount.toLocaleString("en-US")} chatters`
    return `💰 ${grant.pointsEach.toLocaleString("en-US")} points each just went to ${people} active in the last ${grant.windowMinutes} min! Balance and store: ${SITE_URL}/store`
  })
}

export function botPredictionsOpen(huntId: string, opensAt: string, closesAt: string) {
  return once("predictions.open", `predictions-open:${huntId}:${opensAt}`, async () => {
    const minutes = Math.max(1, Math.round((Date.parse(closesAt) - Date.parse(opensAt)) / 60_000))
    return `🔮 Predictions are open for ${minutes} min! Guess the final balance, highest multi and best game at ${SITE_URL}/bonushunt – type !prediction to see yours.`
  })
}

export function botPredictionsClosed(huntId: string, opensAt: string) {
  return once("predictions.closed", `predictions-closed:${huntId}:${opensAt}`, async () => {
    const { count } = await serviceClient()
      .from("hunt_predictions")
      .select("id", { count: "exact", head: true })
      .eq("hunt_id", huntId)
    const entries = count ?? 0
    return `🔒 Predictions are closed – ${entries} ${entries === 1 ? "entry" : "entries"}. Good luck! Type !prediction to see yours.`
  })
}

export function botLeaderboardCreated(boardId: string) {
  return once("leaderboard.created", `leaderboard-created:${boardId}`, async () => {
    const { data: board } = await serviceClient()
      .from("leaderboards")
      .select("id, title, prize_pool")
      .eq("id", boardId)
      .maybeSingle()
    if (!board) return null
    const pool = Number(board.prize_pool) > 0 ? ` – ${money(board.prize_pool)} prize pool` : ""
    return `📊 New leaderboard: ${board.title}${pool}! Standings at ${SITE_URL}/leaderboard`
  })
}

export function botLeaderboardWinners(boardId: string) {
  return once("leaderboard.ended", `leaderboard-ended:${boardId}`, async () => {
    const client = serviceClient()
    const { data: board } = await client.from("leaderboards").select("id, title").eq("id", boardId).maybeSingle()
    if (!board) return null
    const { data: entries } = await client
      .from("leaderboard_entries")
      .select("username, rank, prize_amount")
      .eq("leaderboard_id", boardId)
      .gt("prize_amount", 0)
      .order("rank")
      .limit(3)
    if (!entries?.length) return null
    const medals = ["🥇", "🥈", "🥉"]
    // Masked, as on the public page and in Discord.
    const podium = entries
      .map((entry: any, index: number) => `${medals[index]} ${maskUsername(entry.username)} ${money(entry.prize_amount)}`)
      .join(" · ")
    return `🏁 ${board.title} is final: ${podium}. Full results at ${SITE_URL}/leaderboard`
  })
}
