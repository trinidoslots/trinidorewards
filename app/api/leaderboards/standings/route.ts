import { serviceClient } from "@/lib/supabase/service"
import { fetchStandings, LeaderboardApiError } from "@/lib/leaderboard-api"
import { resolveProvider } from "@/lib/leaderboard-provider-store"

/**
 * Live standings for one leaderboard.
 *
 * GET /api/leaderboards/standings?boardId=<uuid>
 *
 * The board supplies the window and names the feed; the feed's address and key
 * never leave the server. The response carries the neutral model only — no
 * external user ids, no provider field names, no upstream error text. A caller
 * who breaks this open learns that a leaderboard exists and who is winning it,
 * which the page shows anyway.
 *
 * Normally the page reads standings from leaderboard_entries, which the sync job
 * fills every half hour. This is the fallback for a board the job has not
 * reached yet, and the admin panel's way of seeing a feed live.
 *
 * Uses the service client rather than the cookie client because
 * leaderboard_providers has RLS on and no policy: with the anon key the lookup
 * returns nothing and every board would look unconfigured.
 */

export const dynamic = "force-dynamic"

type BoardRow = {
  id: string
  start_date: string
  end_date: string
  source: string | null
  provider_id: string | null
}

export async function GET(request: Request) {
  const boardId = new URL(request.url).searchParams.get("boardId")

  if (!boardId) {
    return Response.json({ error: "boardId is required" }, { status: 400 })
  }

  let supabase: ReturnType<typeof serviceClient>
  try {
    supabase = serviceClient()
  } catch (problem) {
    console.error("[leaderboard] service credentials missing:", problem)
    return Response.json({ error: "The standings could not be loaded." }, { status: 503 })
  }

  const { data, error } = await supabase
    .from("leaderboards")
    // Named columns, not "*": the row carries settings that have no business
    // leaving the server.
    .select("id, start_date, end_date, source, provider_id")
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

  const provider = await resolveProvider(supabase, board.provider_id)
  if (!provider) {
    // Fails closed: without a key this would otherwise call an unauthenticated
    // endpoint and render whatever came back.
    return Response.json({ error: "Live standings are not configured." }, { status: 503 })
  }

  try {
    const standings = await fetchStandings(provider, {
      startDate: board.start_date,
      endDate: board.end_date,
      limit: provider.maxLimit,
    })

    return Response.json(
      { standings },
      {
        headers: {
          // The in-memory cache in lib/leaderboard-api only covers one server
          // instance. This is what keeps the upstream from being hit once per
          // visitor: every viewer of a board shares one cached response for as
          // long as the provider caches it too.
          "Cache-Control": `public, s-maxage=${provider.cacheMinutes * 60}, stale-while-revalidate=300`,
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
