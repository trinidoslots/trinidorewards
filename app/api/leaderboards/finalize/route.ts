import { serviceClient } from "@/lib/supabase/service"
import { requireAdmin } from "@/lib/admin-guard"
import { finalizeDueLeaderboards, finalizeLeaderboard } from "@/lib/leaderboard-finalize"
import { bearerMatches } from "@/lib/bearer"

export const dynamic = "force-dynamic"

/**
 * Closes leaderboards whose window has passed.
 *
 * GET  — run by the Vercel cron in vercel.json, hourly. Finalises everything due.
 * POST — { leaderboardId, force? } to close one board by hand from the admin.
 *
 * Vercel signs cron requests with CRON_SECRET. Without it set the cron is
 * refused rather than left open to anyone; admins still finalize by POST.
 */
function cronAuthorised(request: Request) {
  return bearerMatches(request, process.env.CRON_SECRET)
}

export async function GET(request: Request) {
  if (!cronAuthorised(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = serviceClient()
  const finalized = await finalizeDueLeaderboards(supabase)
  return Response.json({ finalized: finalized.length, leaderboards: finalized })
}

export async function POST(request: Request) {
  // Closing a board by hand is the admin's call. This had no check at all.
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { leaderboardId, force, due } = await request.json().catch(() => ({}) as Record<string, unknown>)

  // { due: true } sweeps every board whose window has closed. The nightly cron
  // does the same thing; this is so the admin is never looking at stale ranks
  // just because the run has not come round yet.
  if (due === true) {
    const supabase = serviceClient()
    const finalized = await finalizeDueLeaderboards(supabase)
    return Response.json({ finalized: finalized.length, leaderboards: finalized })
  }

  if (typeof leaderboardId !== "string" || !leaderboardId) {
    return Response.json({ error: "leaderboardId is required" }, { status: 400 })
  }

  const supabase = serviceClient()
  const result = await finalizeLeaderboard(supabase, leaderboardId, { force: force === true })

  if (!result) {
    return Response.json({ error: "Nothing to finalise — already closed, or no such leaderboard." }, { status: 409 })
  }
  return Response.json(result)
}
