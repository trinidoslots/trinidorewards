import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { clampPointsEach, clampWindowMinutes } from "@/lib/points-activity"

/**
 * Gives points to everyone who was in chat within the window.
 *
 * Three things here are deliberate, and each one is a bug the previous attempt
 * at this feature had:
 *
 *   - The window is recomputed in the database. The list the panel shows is a
 *     preview; if this trusted it, anyone who reached this route could name
 *     their own recipients.
 *   - The balance is incremented in SQL, never written back from a number read
 *     earlier. The existing points dialog does read-modify-write from the
 *     browser, which silently loses one of two concurrent changes.
 *   - An idempotency key makes a double-click, a retry or a flaky connection
 *     produce one grant rather than several.
 *
 * All three live inside grant_points_to_active_chatters (scripts/056), so the
 * balances, the ledger and the on-stream announcement cannot half-happen.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: { windowMinutes?: unknown; pointsEach?: unknown; idempotencyKey?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
  }

  const windowMinutes = clampWindowMinutes(body.windowMinutes)
  const pointsEach = clampPointsEach(body.pointsEach)
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 128) : null

  const { data, error } = await serviceClient().rpc("grant_points_to_active_chatters", {
    p_window_minutes: windowMinutes,
    p_points_each: pointsEach,
    p_granted_by: auth.email,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error("[points] Grant failed:", error)
    return NextResponse.json({ error: error.message || "Could not grant points" }, { status: 500 })
  }

  // The function RETURNS TABLE, so PostgREST hands back an array of one row.
  const result = Array.isArray(data) ? data[0] : data

  if (!result) {
    return NextResponse.json({ error: "Grant returned no result" }, { status: 500 })
  }

  return NextResponse.json({
    grantId: result.granted_id,
    userCount: Number(result.granted_users) || 0,
    totalPoints: Number(result.granted_total) || 0,
    // True when this key had already been used: the panel says "already
    // applied" instead of implying a second grant happened.
    reused: Boolean(result.was_reused),
    windowMinutes,
    pointsEach,
  })
}
