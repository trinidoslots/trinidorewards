import { serviceClient } from "@/lib/supabase/service"
import { discordConfigured, SITE_URL } from "@/lib/discord/config"
import { handleEvent, logToDiscord, type SiteEvent } from "@/lib/discord/announce"
import { claimOnce, releaseOnce } from "@/lib/discord/state"
import { maskUsername } from "@/lib/leaderboard-mask"
import { money } from "@/lib/leaderboard-format"
import { rankEntries } from "@/lib/leaderboard-payouts"
import { entryAmounts, readMetric, metricLabel } from "@/lib/leaderboard-metric"
import { leaderboardStatus } from "@/lib/leaderboard-time"

/**
 * The site telling Discord about itself. Each function reads the row straight
 * from the database — the caller passes an id, never the text to post — and
 * each announces a given thing once, however often it is called.
 *
 * None of them throw. Discord being down or not set up must never fail
 * creating a raffle or closing a leaderboard; it costs a missing post at worst,
 * and the reason lands in the function log.
 */

async function once(key: string, build: () => Promise<SiteEvent | null>): Promise<void> {
  if (!discordConfigured()) return
  try {
    if (!(await claimOnce(key))) return
    try {
      const event = await build()
      if (event) {
        await handleEvent(event)
        await logToDiscord(`🌐 Site event \`${event.type}\` posted.`)
      }
    } catch (problem) {
      // Give the claim back so the next attempt (a re-save, the next cron) can post it.
      await releaseOnce(key)
      throw problem
    }
  } catch (problem) {
    console.error(`[discord] ${key} not announced:`, problem)
  }
}

function rafflePrize(raffle: { prize_name?: string | null; prize_value?: number | null; prize_type?: string | null }) {
  const value = Number(raffle.prize_value) || 0
  if (raffle.prize_type === "points" && value > 0) return `${value.toLocaleString("en-US")} points`
  if (raffle.prize_type === "cash" && value > 0) return raffle.prize_name ? `${raffle.prize_name} (${money(value)})` : money(value)
  return raffle.prize_name || undefined
}

export function announceRaffleCreated(raffleId: string) {
  return once(`raffle-created:${raffleId}`, async () => {
    const { data: raffle } = await serviceClient()
      .from("raffles")
      .select("id, title, description, prize_name, prize_value, prize_type, prize_image_url, end_date, entry_type, ticket_price")
      .eq("id", raffleId)
      .maybeSingle()
    if (!raffle) return null
    const cost = raffle.entry_type === "points" && Number(raffle.ticket_price) > 0 ? `${raffle.ticket_price} points per ticket` : "free"
    return {
      type: "raffle.created",
      data: {
        title: raffle.title,
        description: raffle.description,
        prize: rafflePrize(raffle),
        endsAt: raffle.end_date,
        howToEnter: `Log in on trinidorewards.com with your Kick account and grab a ticket (${cost}).`,
        url: `${SITE_URL}/raffles/${raffle.id}`,
        imageUrl: raffle.prize_image_url,
      },
    }
  })
}

export function announceRaffleWinner(raffleId: string) {
  return once(`raffle-ended:${raffleId}`, async () => {
    const { data: raffle } = await serviceClient()
      .from("raffles")
      .select("id, title, prize_name, prize_value, prize_type, winner_username")
      .eq("id", raffleId)
      .maybeSingle()
    if (!raffle?.winner_username) return null
    return {
      type: "raffle.ended",
      data: {
        title: raffle.title,
        winners: [{ name: raffle.winner_username, prize: rafflePrize(raffle) }],
        url: `${SITE_URL}/raffles/${raffle.id}`,
      },
    }
  })
}

export function announceLeaderboardCreated(boardId: string) {
  return once(`leaderboard-created:${boardId}`, async () => {
    const { data: board } = await serviceClient()
      .from("leaderboards")
      .select("id, title, subtitle, prize_pool, start_date, end_date, image_url")
      .eq("id", boardId)
      .maybeSingle()
    if (!board) return null
    return {
      type: "leaderboard.created",
      data: {
        title: board.title,
        description: board.subtitle,
        prizePool: Number(board.prize_pool) > 0 ? money(board.prize_pool) : undefined,
        startsAt: board.start_date,
        endsAt: board.end_date,
        url: `${SITE_URL}/leaderboard`,
        imageUrl: board.image_url,
      },
    }
  })
}

/** After finalizeLeaderboard has frozen the ranks. Names masked, as on the public page. */
export function announceLeaderboardWinners(boardId: string) {
  return once(`leaderboard-ended:${boardId}`, async () => {
    const client = serviceClient()
    const { data: board } = await client.from("leaderboards").select("id, title").eq("id", boardId).maybeSingle()
    if (!board) return null
    const { data: entries } = await client
      .from("leaderboard_entries")
      .select("username, rank, prize_amount")
      .eq("leaderboard_id", boardId)
      .gt("prize_amount", 0)
      .order("rank")
      .limit(10)
    return {
      type: "leaderboard.ended",
      data: {
        title: board.title,
        winners: (entries ?? []).map((entry: any) => ({
          rank: Number(entry.rank),
          name: maskUsername(entry.username),
          prize: money(entry.prize_amount),
        })),
        url: `${SITE_URL}/leaderboard`,
      },
    }
  })
}

/** The running board's top ten, for /leaderboard. Same ranking and masking as the page. */
export async function currentStandings(): Promise<{ title: string; endsAt: string; metric: string; lines: string[] } | null> {
  const client = serviceClient()
  const { data: boards } = await client
    .from("leaderboards")
    .select("id, title, start_date, end_date, prize_pool, payout_preset, prize_distribution_type, ranking_metric")
    .order("created_at", { ascending: false })
  const board = (boards ?? []).find((b: any) => leaderboardStatus(b.start_date, b.end_date) === "active")
  if (!board) return null

  const { data: entries } = await client.from("leaderboard_entries").select("*").eq("leaderboard_id", board.id)
  const metric = readMetric(board.ranking_metric)
  const rows = (entries ?? []).map((entry: Record<string, unknown>) => ({
    username: String(entry.username ?? ""),
    ...entryAmounts(entry),
  }))
  const ranked = rankEntries(rows, Number(board.prize_pool) || 0, board.payout_preset ?? board.prize_distribution_type, metric)
  const medals = ["🥇", "🥈", "🥉"]
  const lines = ranked.slice(0, 10).map((entry) => {
    const amount = metric === "earned" ? entry.total_earned : entry.total_wagered
    const prize = entry.prize_amount > 0 ? ` · 🎁 ${money(entry.prize_amount)}` : ""
    return `${medals[entry.rank - 1] ?? `**${entry.rank}.**`} ${maskUsername(entry.username)} — ${money(amount)}${prize}`
  })
  return { title: board.title, endsAt: board.end_date, metric: metricLabel(metric), lines }
}
