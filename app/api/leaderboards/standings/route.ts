import { createClient } from "@/lib/supabase/server"
import { fetchStandings, LeaderboardApiError, MAX_LIMIT, CACHE_TTL_MS } from "@/lib/leaderboard-api"

/**
 * Live standings for one leaderboard.
 *
 * GET /api/leaderboards/standings?boardId=<uuid>
 *
 * The board supplies the window; the provider's URL and key never leave the
 * server. The response carries the neutral model only — no external user ids, no
 * provider field names, no upstream error text. A caller who breaks this open
 * learns that a leaderboard exists and who is winning it, which the page shows
 * anyway.
 *
 * Only boards with source = 'api' answer here. A CSV board's standings live in
 * leaderboard_entries and the page reads those directly.
 */

export const dynamic = "force-dynamic"

/** Seconds the CDN may serve this response to everyone. */
const EDGE_TTL_SECONDS = Math.floor(CACHE_TTL_MS / 1000)

type BoardRow = {
  id: string
  start_date: string
  end_date: string
  source: string | null
}

export async function GET(request: Request) {
  const boardId = new URL(request.url).searchParams.get("boardId")

  if (!boardId) {
    return Response.json({ error: "boardId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leaderboards")
    // Named columns, not "*": the row carries settings that have no business
    // leaving the server.
    .select("id, start_date, end_date, source")
    .eq("id", boardId)
    .maybeSingle()

  if (error) {
    // The Postgres message can name columns and constraints. It goes to the log.
    console.error("[leaderboard] board lookup failed:", error.message)
    return Response.json({ error: "The standings could not be loaded." }, { status: 500 })
  }

  const board = data as BoardRow | null
  if (!board) {
    return Response.json({ error: "No such leaderboard." }, { status: 404 })
  }

  if (board.source !== "api") {
    return Response.json({ error: "That leaderboard does not use live standings." }, { status: 409 })
  }

  try {
    const standings = await fetchStandings({
      startDate: board.start_date,
      endDate: board.end_date,
      limit: MAX_LIMIT,
    })

    return Response.json(
      { standings },
      {
        headers: {
          // The in-memory cache in lib/leaderboard-api only covers one server
          // instance. This is what actually keeps the upstream from being hit
          // once per visitor: every viewer of a given board shares one cached
          // response for the same half hour the provider caches it for.
          "Cache-Control": `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=300`,
        },
      },
    )
  } catch (problem) {
    if (problem instanceof LeaderboardApiError) {
      // These messages are written to be read by a visitor and name neither the
      // provider nor the reason in any detail.
      return Response.json({ error: problem.message }, { status: problem.status })
    }
    console.error("[leaderboard] unexpected standings failure:", problem)
    return Response.json({ error: "The standings could not be loaded." }, { status: 500 })
  }
}
