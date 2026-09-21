import { serviceClient } from "@/lib/supabase/service"
import { fetchStandingsWithRef, LeaderboardApiError, MAX_LIMIT } from "@/lib/leaderboard-api"

/**
 * Pulls every running API board's standings into leaderboard_entries.
 *
 * Called by pg_cron in Supabase every 30 minutes — see
 * scripts/060_leaderboard_sync_cron.sql. Vercel's own cron cannot do this: on
 * Hobby a job may only fire once a day, and there are two slots, both taken.
 *
 * Writing to the table rather than warming a cache is the whole point. The map
 * in lib/leaderboard-api only lives inside one serverless instance, and the next
 * request lands somewhere else — a job that warmed it would achieve nothing.
 * Stored rows are shared by every instance and every visitor, survive the feed
 * being down, and give finalizeLeaderboard something to freeze when the board
 * closes.
 *
 * POST and GET do the same thing, because pg_net makes either awkward depending
 * on which helper you reach for.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

type BoardRow = {
  id: string
  title: string
  start_date: string
  end_date: string
}

/**
 * Unlike the finalize cron, this one refuses to run without a secret rather
 * than falling open. That route only recomputes from rows that are already
 * there; this one writes the standings, so an open endpoint would let anyone
 * make the board say whatever the feed says at a moment of their choosing —
 * and burn the 2-requests-per-minute budget while they did it.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

type BoardOutcome = {
  leaderboardId: string
  title: string
  entries?: number
  removed?: number
  error?: string
}

async function syncBoard(
  supabase: ReturnType<typeof serviceClient>,
  board: BoardRow,
): Promise<BoardOutcome> {
  let standings
  try {
    standings = await fetchStandingsWithRef({
      startDate: board.start_date,
      endDate: board.end_date,
      limit: MAX_LIMIT,
    })
  } catch (problem) {
    const message = problem instanceof LeaderboardApiError ? problem.message : "Could not reach the feed."
    console.error(`[leaderboard-sync] ${board.id} fetch failed:`, problem)
    return { leaderboardId: board.id, title: board.title, error: message }
  }

  // A row the feed cannot identify cannot be matched to an existing one, so it
  // would be inserted again on every run. Better to skip it than to grow the
  // table by fifty rows every half hour.
  const rows = standings
    .filter((row) => row.ref !== null)
    .map((row) => ({
      leaderboard_id: board.id,
      user_ref: row.ref,
      username: row.username,
      avatar_url: row.avatar,
      total_wagered: row.score,
      total_earned: 0,
      // rank and prize_amount stay untouched: the page works them out live from
      // the pool and the preset, and finalizeLeaderboard writes them once when
      // the board closes. Writing a rank here would fight that.
      rank: row.rank,
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) {
    return { leaderboardId: board.id, title: board.title, entries: 0 }
  }

  // Upsert rather than delete-then-insert: a board that is emptied and refilled
  // every thirty minutes shows an empty table to whoever loads it in between.
  const { error: writeError } = await supabase
    .from("leaderboard_entries")
    .upsert(rows, { onConflict: "leaderboard_id,user_ref" })

  if (writeError) {
    console.error(`[leaderboard-sync] ${board.id} write failed:`, writeError.message)
    return { leaderboardId: board.id, title: board.title, error: "Could not store the standings." }
  }

  // Players who dropped out of the top 50 since the last run. Left alone they
  // would sit on the board forever with a stale figure.
  //
  // Worked out here rather than with a "not in (…)" filter: that means building
  // the id list into a PostgREST filter string by hand, and an id carrying a
  // comma or a quote would then delete the wrong rows. Two queries and a Set
  // cannot be got wrong that way.
  const keep = new Set(rows.map((row) => row.user_ref as string))
  let removed = 0

  const { data: existing, error: readError } = await supabase
    .from("leaderboard_entries")
    .select("id, user_ref")
    .eq("leaderboard_id", board.id)

  if (readError) {
    console.error(`[leaderboard-sync] ${board.id} cleanup read failed:`, readError.message)
  } else {
    const stale = (existing ?? [])
      .filter((row: { id: string; user_ref: string | null }) => row.user_ref && !keep.has(row.user_ref))
      .map((row: { id: string }) => row.id)

    if (stale.length > 0) {
      const { error: deleteError } = await supabase.from("leaderboard_entries").delete().in("id", stale)
      if (deleteError) {
        // The board is correct, it just has stragglers on it. Not worth failing.
        console.error(`[leaderboard-sync] ${board.id} cleanup failed:`, deleteError.message)
      } else {
        removed = stale.length
      }
    }
  }

  return {
    leaderboardId: board.id,
    title: board.title,
    entries: rows.length,
    removed,
  }
}

async function run(request: Request) {
  if (!authorised(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // serviceClient throws when the service-role variable is missing. Uncaught,
  // that is a 500 with a stack trace in the cron's response body rather than a
  // sentence saying which variable to set.
  let supabase: ReturnType<typeof serviceClient>
  try {
    supabase = serviceClient()
  } catch (problem) {
    console.error("[leaderboard-sync] service credentials missing:", problem)
    return Response.json({ error: "Supabase service credentials are not configured." }, { status: 503 })
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("leaderboards")
    .select("id, title, start_date, end_date")
    .eq("source", "api")
    // Only boards that are actually running. A closed board's numbers are
    // history, and a board that has not opened has nothing to fetch.
    .lte("start_date", now)
    .gt("end_date", now)
    .is("finalized_at", null)

  if (error) {
    console.error("[leaderboard-sync] could not list boards:", error.message)
    return Response.json({ error: "Could not list leaderboards." }, { status: 500 })
  }

  const boards = (data ?? []) as BoardRow[]

  // Sequential on purpose: the feed allows two requests a minute, and firing
  // every board at once is the quickest way to spend that on a 429.
  const results: BoardOutcome[] = []
  for (const board of boards) {
    results.push(await syncBoard(supabase, board))
  }

  const failed = results.filter((result) => result.error).length

  return Response.json(
    {
      synced: results.length - failed,
      failed,
      boards: results,
    },
    // A partial failure is still a failure worth seeing in the cron's own log.
    { status: failed > 0 && failed === results.length && results.length > 0 ? 502 : 200 },
  )
}

export async function POST(request: Request) {
  return run(request)
}

export async function GET(request: Request) {
  return run(request)
}
