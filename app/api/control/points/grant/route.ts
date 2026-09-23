import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { clampWindowMinutes } from "@/lib/points-activity"

/**
 * The same grant as /api/admin/points/grant, for a device with no browser.
 *
 * A Stream Deck cannot carry a Supabase session, so requireAdmin() would turn
 * every press into a 401. This route checks a static bearer token instead and
 * then calls the identical function, so the rules that decide who gets paid
 * stay in one place: the window is still recomputed in the database, balances
 * are still incremented in SQL, and the idempotency key still collapses a
 * double press into one grant.
 *
 * Its own token, not EXTENSION_API_KEY: this one sits in a script file on the
 * streaming PC, and leaking it must not also hand over the extension's write
 * access to the hunt.
 */

export const dynamic = "force-dynamic"

/**
 * Lower than MAX_POINTS_EACH on purpose. The admin route is behind a login and
 * a confirmation dialog; this one is behind a token in a text file, so the
 * worst a leak can do is capped at something the economy survives. No button
 * on a Stream Deck needs more than this.
 */
const MAX_POINTS_EACH = 10_000

function isAuthorized(request: Request) {
  const expected = process.env.CONTROL_API_KEY
  if (!expected) return false
  const header = request.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  return token === expected
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    // Deliberately the same answer whether the key is wrong or unset: nothing
    // here tells a stranger which of the two it is.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { windowMinutes?: unknown; pointsEach?: unknown; idempotencyKey?: unknown; grantedBy?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
  }

  const windowMinutes = clampWindowMinutes(body.windowMinutes)

  // Not clampPointsEach: that one silently falls back to 100 for a missing or
  // unreadable value. A button that was meant to pay 500 and pays 100 because
  // of a typo in the script is worse than one that refuses to fire.
  const pointsEach = Math.floor(Number(body.pointsEach))
  if (!Number.isFinite(pointsEach) || pointsEach < 1 || pointsEach > MAX_POINTS_EACH) {
    return NextResponse.json(
      { error: `pointsEach must be a whole number between 1 and ${MAX_POINTS_EACH}` },
      { status: 400 },
    )
  }

  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 128) : null
  const grantedBy = typeof body.grantedBy === "string" && body.grantedBy.trim() ? body.grantedBy.trim().slice(0, 64) : "stream-deck"

  let client: ReturnType<typeof serviceClient>
  try {
    client = serviceClient()
  } catch (problem) {
    return NextResponse.json(
      { error: problem instanceof Error ? problem.message : "Supabase service role is not configured." },
      { status: 503 },
    )
  }

  const { data, error } = await client.rpc("grant_points_to_active_chatters", {
    p_window_minutes: windowMinutes,
    p_points_each: pointsEach,
    p_granted_by: grantedBy,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error("[control] Grant failed:", error)
    return NextResponse.json({ error: error.message || "Could not grant points" }, { status: 500 })
  }

  const result = Array.isArray(data) ? data[0] : data
  if (!result) {
    return NextResponse.json({ error: "Grant returned no result" }, { status: 500 })
  }

  return NextResponse.json({
    grantId: result.granted_id,
    userCount: Number(result.granted_users) || 0,
    totalPoints: Number(result.granted_total) || 0,
    reused: Boolean(result.was_reused),
    windowMinutes,
    pointsEach,
  })
}
