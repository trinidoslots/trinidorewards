import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { isValidCode, normalizeCode } from "@/lib/promo-codes"

/**
 * Redeeming a promo code for points.
 *
 * Who is asking comes from the signed session, never from the body. The checks
 * and the credit are one database call (redeem_promo_code, scripts/075), so a
 * double click or two tabs cannot claim a code twice or lose a concurrent
 * balance change.
 */

const REASONS: Record<string, { status: number; error: string }> = {
  invalid: { status: 404, error: "That code doesn't exist or isn't active." },
  used_up: { status: 410, error: "That code has been fully claimed." },
  already: { status: 409, error: "You've already redeemed this code." },
  code_users_only: { status: 403, error: "This code is for Code Users only." },
}

export async function POST(request: Request) {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ error: "Please log in to redeem a code." }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null
  const code = normalizeCode(body?.code)
  if (!isValidCode(code)) return NextResponse.json({ error: REASONS.invalid.error }, { status: REASONS.invalid.status })

  const { data, error } = await serviceClient().rpc("redeem_promo_code", {
    p_code: code,
    p_user_id: session.userId,
    p_username: session.username,
  })

  if (error) {
    console.error("[promo] redeem:", error)
    return NextResponse.json({ error: "Could not redeem that code right now." }, { status: 500 })
  }

  const result = data as { ok: boolean; reason?: string; points?: number; balance?: number; code?: string }
  if (!result?.ok) {
    const reason = REASONS[result?.reason ?? "invalid"] ?? REASONS.invalid
    return NextResponse.json({ error: reason.error }, { status: reason.status })
  }

  return NextResponse.json({ code: result.code, points: result.points, balance: Number(result.balance) || 0 })
}
