import { requireAdmin, requireStaff } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { after } from "next/server"
import { isValidCode, MAX_POINTS, normalizeCode, randomCode } from "@/lib/promo-codes"
import { botPromoShown } from "@/lib/kick-bot/announce"

/**
 * Promo codes, for /admin/promo-codes.
 *
 * GET    — every code, newest first.
 * POST   — { code?, points, max_uses?, code_user_only? } creates one, disabled; no code means a random one.
 * PATCH  — { id, is_active?, show_on_stream? } flips the two switches.
 * DELETE — ?id= removes a code. Points already credited stay credited.
 *
 * Through the service role rather than from the browser: promo_codes has no
 * write policy, and reading it is limited to the codes currently on stream.
 */

export const dynamic = "force-dynamic"

// "*" rather than a list: code_user_only arrives with scripts/076, and naming a
// column that is not there yet fails the whole request.
const COLUMNS = "*"

export async function GET() {
  // Moderators may look at the codes; creating and switching them stays admin-only.
  const auth = await requireStaff()
  if (!auth.ok) return auth.response

  const { data, error } = await serviceClient().from("promo_codes").select(COLUMNS).order("created_at", { ascending: false })
  if (error) {
    console.error("[promo] list:", error)
    const missing = error.code === "42P01" || /does not exist/.test(error.message)
    return Response.json(
      { error: missing ? "The promo_codes table is missing – run scripts/075_promo_codes.sql in Supabase." : "Could not load the codes." },
      { status: 500 },
    )
  }
  return Response.json({ codes: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const points = Number(body.points)
  if (!Number.isInteger(points) || points <= 0 || points > MAX_POINTS) {
    return Response.json({ error: `Points must be a whole number between 1 and ${MAX_POINTS.toLocaleString("en-US")}.` }, { status: 400 })
  }

  const maxUses = body.max_uses === undefined || body.max_uses === null || body.max_uses === "" ? null : Number(body.max_uses)
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    return Response.json({ error: "Max uses must be a whole number above 0, or empty for unlimited." }, { status: 400 })
  }

  const typed = normalizeCode(body.code)
  if (typed && !isValidCode(typed)) {
    return Response.json({ error: "Codes are 3–32 characters: letters, numbers, - and _." }, { status: 400 })
  }

  // A random code can in principle collide with an existing one; try again rather than fail.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = typed || randomCode()
    const { data, error } = await serviceClient()
      .from("promo_codes")
      // Created switched off: a code goes live when the admin activates it,
      // not the moment it is typed in.
      .insert({
        code,
        points,
        max_uses: maxUses,
        created_by: auth.email,
        is_active: false,
        // Only sent when set, so creating a normal code works before scripts/076.
        ...(body.code_user_only === true ? { code_user_only: true } : {}),
      })
      .select(COLUMNS)
      .single()

    if (!error) return Response.json({ code: data })
    if (error.code === "23505") {
      if (typed) return Response.json({ error: `The code ${typed} already exists.` }, { status: 409 })
      continue
    }
    console.error("[promo] create:", error)
    return Response.json({ error: "Could not create the code." }, { status: 500 })
  }
  return Response.json({ error: "Could not create the code." }, { status: 500 })
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = typeof body.id === "string" ? body.id : ""
  if (!id) return Response.json({ error: "id is required" }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.is_active === "boolean") update.is_active = body.is_active
  if (typeof body.show_on_stream === "boolean") {
    update.show_on_stream = body.show_on_stream
    // Putting it on stream counts as a fresh event, so it lands on top of the column.
    if (body.show_on_stream) update.shown_at = new Date().toISOString()
  }
  if (Object.keys(update).length === 1) return Response.json({ error: "Nothing to change" }, { status: 400 })

  const { data, error } = await serviceClient().from("promo_codes").update(update).eq("id", id).select(COLUMNS).single()
  if (error) {
    console.error("[promo] update:", error)
    return Response.json({ error: "Could not update the code." }, { status: 500 })
  }
  // Put on stream: the Kick bot posts it in chat too.
  const shown = data as { id?: string; shown_at?: string | null } | null
  if (body.show_on_stream === true && shown?.id && shown.shown_at) {
    const { id: promoId, shown_at: shownAt } = shown
    after(() => botPromoShown(promoId, shownAt))
  }
  return Response.json({ code: data })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return Response.json({ error: "id is required" }, { status: 400 })

  const { error } = await serviceClient().from("promo_codes").delete().eq("id", id)
  if (error) {
    console.error("[promo] delete:", error)
    return Response.json({ error: "Could not delete the code." }, { status: 500 })
  }
  return Response.json({ ok: true })
}
