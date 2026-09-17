import { createClient } from "@/lib/supabase/server"
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

  const supabase = await createClient()
  const finalized = await finalizeDueLeaderboards(supabase)
  return Response.json({ finalized: finalized.length, leaderboards: finalized })
}

export async function POST(request: Request) {
  const { leaderboardId, force } = await request.json().catch(() => ({}) as Record<string, unknown>)

  if (typeof leaderboardId !== "string" || !leaderboardId) {
    return Response.json({ error: "leaderboardId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const result = await finalizeLeaderboard(supabase, leaderboardId, { force: force === true })

  if (!result) {
    return Response.json({ error: "Nothing to finalise — already closed, or no such leaderboard." }, { status: 409 })
  }
  return Response.json(result)
}
