import { serviceClient } from "@/lib/supabase/service"
import { requireAdmin } from "@/lib/admin-guard"
import { finalizeDueLeaderboards, finalizeLeaderboard } from "@/lib/leaderboard-finalize"

export const dynamic = "force-dynamic"

/**
 * Closes leaderboards whose window has passed.
 *
 * GET  — run by the Vercel cron in vercel.json, hourly. Finalises everything due.
 * POST — { leaderboardId, force? } to close one board by hand from the admin.
 *
 * Vercel signs cron requests with CRON_SECRET when it is set; if it is not set
 * the route stays open, which is the same posture as the rest of this app's
 * routes rather than a decision made here.
 */
function cronAuthorised(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
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
