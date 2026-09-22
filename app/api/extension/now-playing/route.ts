import { type NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { readNowPlaying, type NowPlayingRow } from "@/lib/now-playing"

/**
 * "Set as now playing", from the extension's button on the casino page.
 *
 * Authenticated the same way as /api/extension/add-bonus — a static bearer
 * token, not a Supabase session — so it takes the service-role client for the
 * same reason: now_playing has no write policy, and the anon key cannot touch
 * it.
 */

export const dynamic = "force-dynamic"

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

/** Lets the extension show what is currently on the overlay. */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const supabase = getServiceRoleClient()
  const { data, error } = await supabase.from("now_playing").select("*").eq("id", 1).maybeSingle()

  if (error) {
    console.error("[v0] extension now-playing read error:", error)
    return NextResponse.json({ error: "Failed to read" }, { status: 500 })
  }

  return NextResponse.json({ success: true, now_playing: data as NowPlayingRow | null })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
  }

  const patch = readNowPlaying(body as Record<string, unknown>, "extension")

  // The whole point of the button is that a game is on screen. Refusing an
  // empty name here means a failed scrape shows an error on the casino page
  // rather than silently clearing the bar mid-stream.
  if (!patch.slot_name) {
    return NextResponse.json({ error: "Could not read a game name from this page" }, { status: 400 })
  }

  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from("now_playing")
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .maybeSingle()

  if (error) {
    console.error("[v0] extension now-playing write error:", error)
    return NextResponse.json({ error: "Failed to set" }, { status: 500 })
  }

  return NextResponse.json({ success: true, now_playing: data as NowPlayingRow })
}

/** Clears the bar from the casino page, without going to the admin panel. */
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const supabase = getServiceRoleClient()
  const { error } = await supabase
    .from("now_playing")
    .upsert(
      {
        id: 1,
        slot_name: null,
        provider: null,
        image_url: null,
        max_win: null,
        badge: null,
        source: "extension",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )

  if (error) {
    console.error("[v0] extension now-playing clear error:", error)
    return NextResponse.json({ error: "Failed to clear" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
