import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { MAX_COUNTDOWN_DAYS, type StartingSoonRow } from "@/lib/starting-soon"

/**
 * The countdown on /obs/starting-soon.
 *
 * Reads go straight to the table from the browser — it has a public SELECT
 * policy, because the OBS source has nothing but the anon key. Writes come
 * through here so that the same anon key cannot set your countdown: the table
 * has no write policy at all, and this route uses the service role, which
 * bypasses RLS.
 */

export const dynamic = "force-dynamic"

const MAX_HEADLINE = 80
const MAX_SUBLINE = 200

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/** Trims, collapses an empty string to null, and caps the length. */
function readText(value: unknown, limit: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, limit)
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let supabase
  try {
    supabase = serviceClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Supabase service role is not configured." },
      { status: 503 },
    )
  }

  const { data, error } = await supabase.from("starting_soon").select("*").eq("id", 1).maybeSingle()
  if (error) {
    console.error("[v0] starting_soon read failed:", error)
    return NextResponse.json({ error: "Could not read the countdown." }, { status: 500 })
  }

  return NextResponse.json({ row: data as StartingSoonRow | null })
}

export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return badRequest("Expected a JSON body.")
  }

  const patch: Record<string, unknown> = {}

  if ("starts_at" in body) {
    const raw = body.starts_at
    if (raw === null || raw === "") {
      // Deliberately clearable: a screen with a headline and no clock is a
      // legitimate state, not a missing value.
      patch.starts_at = null
    } else if (typeof raw !== "string") {
      return badRequest("starts_at must be an ISO timestamp or null.")
    } else {
      const parsed = Date.parse(raw)
      if (!Number.isFinite(parsed)) return badRequest("That start time could not be read.")

      // A countdown set a year out is a mistyped date, not a plan. Catching it
      // here means the overlay never has to render a four-digit hour.
      const daysAway = (parsed - Date.now()) / 86_400_000
      if (daysAway > MAX_COUNTDOWN_DAYS) {
        return badRequest(`That is more than ${MAX_COUNTDOWN_DAYS} days away — check the date.`)
      }
      patch.starts_at = new Date(parsed).toISOString()
    }
  }

  const headline = readText(body.headline, MAX_HEADLINE)
  // The headline is what the screen is; blanking it would leave an empty scene,
  // so an empty value is rejected rather than stored.
  if (headline === null) return badRequest("The headline cannot be empty.")
  if (headline !== undefined) patch.headline = headline

  const endedText = readText(body.ended_text, MAX_HEADLINE)
  if (endedText === null) return badRequest("The ended text cannot be empty.")
  if (endedText !== undefined) patch.ended_text = endedText

  const subline = readText(body.subline, MAX_SUBLINE)
  if (subline !== undefined) patch.subline = subline

  if (Object.keys(patch).length === 0) return badRequest("Nothing to update.")
  patch.updated_at = new Date().toISOString()

  let supabase
  try {
    supabase = serviceClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Supabase service role is not configured." },
      { status: 503 },
    )
  }

  // upsert rather than update: the row is seeded by the migration, but a
  // database restored without it would otherwise fail silently with 0 rows.
  const { data, error } = await supabase
    .from("starting_soon")
    .upsert({ id: 1, ...patch }, { onConflict: "id" })
    .select("*")
    .maybeSingle()

  if (error) {
    console.error("[v0] starting_soon write failed:", error)
    return NextResponse.json({ error: "Could not save the countdown." }, { status: 500 })
  }

  return NextResponse.json({ row: data as StartingSoonRow })
}
