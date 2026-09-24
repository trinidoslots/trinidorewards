import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { explainDbError, readMoney, readMultiplier, readNowPlaying, type NowPlayingRow } from "@/lib/now-playing"
import { announceRecord, currentBestWin, resolveNowPlaying } from "@/lib/slot-meta"

/**
 * The same row as /api/extension/now-playing, from the admin panel instead.
 *
 * Two routes rather than one shared one because the two callers authenticate
 * completely differently — a static bearer token from a browser extension, and
 * a signed-in admin session — and folding both into a single handler means one
 * `if` deciding which of two security models applies to a request.
 */

export const dynamic = "force-dynamic"

function withService<T>(run: (client: ReturnType<typeof serviceClient>) => T) {
  try {
    return { ok: true as const, value: run(serviceClient()) }
  } catch (error) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: error instanceof Error ? error.message : "Supabase service role is not configured." },
        { status: 503 },
      ),
    }
  }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const client = withService((c) => c)
  if (!client.ok) return client.response

  const { data, error } = await client.value.from("now_playing").select("*").eq("id", 1).maybeSingle()
  if (error) {
    console.error("[v0] now_playing read failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not read what is playing.") }, { status: 500 })
  }

  return NextResponse.json({ row: data as NowPlayingRow | null })
}

export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const typed = readNowPlaying(body, "admin")
  if (!typed.slot_name) {
    return NextResponse.json({ error: "A slot name is required — use Clear to take the bar down." }, { status: 400 })
  }

  const client = withService((c) => c)
  if (!client.ok) return client.response

  // Measured before the save, because the save is what moves it. Only needed
  // when a figure was typed — an empty field can never be a record.
  const typedBest = readMoney(body.best_win)
  const previousBest = typedBest !== null ? await currentBestWin(client.value, typed.slot_name) : null

  // authored: these fields were typed, so an empty one means empty. Without
  // it, clearing the badge or the provider did nothing — the value came back
  // out of slot_meta on the way to the overlay.
  //
  // An empty Best Win field is the one exception. It means "work it out from
  // the hunts", not "zero", so it goes through as an explicit null.
  const patch = await resolveNowPlaying(client.value, typed, {
    bestWin: typedBest,
    authored: true,
  })

  const { data, error } = await client.value
    .from("now_playing")
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .maybeSingle()

  if (error) {
    console.error("[v0] now_playing write failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not save.") }, { status: 500 })
  }

  // Beating the figure the bar showed is a record. A slot with no best win yet
  // has nothing to beat, so typing its first one is just setting it.
  let record = false
  if (typedBest !== null && previousBest !== null && previousBest > 0 && typedBest > previousBest) {
    record = await announceRecord(client.value, {
      slot_name: patch.slot_name ?? typed.slot_name,
      provider: patch.provider,
      image_url: patch.image_url,
      win: typedBest,
      multiplier: readMultiplier(body.record_multiplier),
      previous_best: previousBest,
    })
  }

  return NextResponse.json({ row: data as NowPlayingRow, record })
}

/** Takes the bar off the stream. The row stays; every field is emptied. */
export async function DELETE() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const client = withService((c) => c)
  if (!client.ok) return client.response

  const { data, error } = await client.value
    .from("now_playing")
    .upsert(
      {
        id: 1,
        slot_name: null,
        provider: null,
        image_url: null,
        max_win: null,
        badge: null,
        best_win: null,
        source: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle()

  if (error) {
    console.error("[v0] now_playing clear failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not clear.") }, { status: 500 })
  }

  return NextResponse.json({ row: data as NowPlayingRow })
}
