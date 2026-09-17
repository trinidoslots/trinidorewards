import { type NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { getActiveHunt } from "@/lib/active-hunt"

// Service-role client: the Chrome extension authenticates with a static
// bearer token (EXTENSION_API_KEY), not a Supabase session, so RLS-scoped
// clients don't apply here.
function getServiceRoleClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.EXTENSION_API_KEY
  if (!expected) return false
  const header = request.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  return token === expected
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

// GET: lets the extension popup show whether there's an active hunt to add to,
// including the bonuses already logged for it so the popup can render a list.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const supabase = getServiceRoleClient()
  const hunt = await getActiveHunt(supabase)

  if (!hunt) {
    return NextResponse.json({ success: true, hunt: null })
  }

  const [{ data: bonusRows, error: bonusesError }, { data: openingStateRow, error: openingStateError }] =
    await Promise.all([
      supabase
        .from("hunt_bonuses")
        .select("id, game_name, provider, bet_size, result, image_url, position, created_at")
        .eq("hunt_id", hunt.id)
        .order("position", { ascending: true }),
      supabase.from("opening_state").select("is_opening").eq("id", 1).maybeSingle(),
    ])

  if (bonusesError) {
    console.error("[v0] extension get-hunt bonuses fetch error:", bonusesError)
  }
  if (openingStateError) {
    console.error("[v0] extension get-hunt opening_state fetch error:", openingStateError)
  }

  // `order` mirrors the stable `position` column on hunt_bonuses (zero-indexed:
  // the first bonus ever added/queued has order 0). It is set at insert time
  // to the next available index for the hunt, and is the ONLY field the
  // dashboard's drag-and-drop reorder updates when the streamer manually
  // reorders the queue — created_at is left untouched so it keeps reflecting
  // true insertion time. The extension should treat the unpaid bonus (no
  // `payout`) with the lowest `order` as "next in line" while hunt.is_opening
  // is true.
  const bonuses = (bonusRows ?? []).map((row) => ({
    id: row.id,
    slot_name: row.game_name,
    provider: row.provider,
    bet_size: row.bet_size,
    payout: row.result,
    image_url: row.image_url,
    order: row.position,
  }))

  // is_opening mirrors the `opening_state` singleton row (id=1) — the same
  // table the admin "Start Opening"/"Exit"/"End Hunt"/"Reset Hunt" actions
  // already write to. The extension checks hunt.is_opening (boolean).
  const isOpening = Boolean(openingStateRow?.is_opening)

  return NextResponse.json({
    success: true,
    hunt: {
      id: hunt.id,
      streamer: hunt.streamer,
      title: hunt.title,
      starting_balance: hunt.starting_balance,
      is_opening: isOpening,
      bonuses,
    },
  })
}

// POST: adds a bonus (game name + bet size) to the currently active hunt.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const body = await request.json().catch(() => null)
  const gameName = typeof body?.game_name === "string" ? body.game_name.trim() : ""
  const betSize = Number(body?.bet_size)
  const provider = typeof body?.provider === "string" && body.provider.trim() ? body.provider.trim() : null
  const isSuper = Boolean(body?.is_super)
  const imageUrl = typeof body?.image_url === "string" && body.image_url.trim() ? body.image_url.trim() : null

  if (!gameName) {
    return NextResponse.json({ error: "game_name is required" }, { status: 400 })
  }
  if (!Number.isFinite(betSize) || betSize <= 0) {
    return NextResponse.json({ error: "bet_size must be a positive number" }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  const hunt = await getActiveHunt(supabase)

  if (!hunt) {
    return NextResponse.json({ error: "No active bonus hunt" }, { status: 404 })
  }

  // The new bonus always joins the end of the queue: next position = current count.
  const { count: existingCount, error: countError } = await supabase
    .from("hunt_bonuses")
    .select("id", { count: "exact", head: true })
    .eq("hunt_id", hunt.id)

  if (countError) {
    console.error("[v0] extension add-bonus count error:", countError)
    return NextResponse.json({ error: "Failed to add bonus" }, { status: 500 })
  }

  const { data, error } = await supabase
    .from("hunt_bonuses")
    .insert({
      hunt_id: hunt.id,
      game_name: gameName,
      provider,
      bet_size: betSize,
      is_super: isSuper,
      image_url: imageUrl,
      position: existingCount ?? 0,
    })
    .select("id, hunt_id, game_name, provider, bet_size, result, is_super, image_url, position, created_at")
    .single()

  if (error) {
    console.error("[v0] extension add-bonus insert error:", error)
    return NextResponse.json({ error: "Failed to add bonus" }, { status: 500 })
  }

  return NextResponse.json({ success: true, bonus: data, hunt_id: hunt.id })
}

// DELETE: supports the extension's "Undo" action right after adding a bonus.
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const id = request.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  const { error } = await supabase.from("hunt_bonuses").delete().eq("id", id)

  if (error) {
    console.error("[v0] extension delete-bonus error:", error)
    return NextResponse.json({ error: "Failed to delete bonus" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
