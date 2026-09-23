import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { explainDbError } from "@/lib/now-playing"
import {
  MAX_DURATION_SECONDS,
  applyTimerAction,
  type ObsTimerRow,
  type OnZero,
  type TimerAction,
} from "@/lib/obs-timers"

/**
 * The timers on the top bar.
 *
 * These used to be written straight from the admin page with the public anon
 * key, which shipped in the browser bundle of every page on the site, against
 * a table whose insert, update and delete policies were all USING (true).
 * Anyone who opened the site could put a timer on the stream. Migration 068
 * drops those policies; writes come through here, where the admin session is
 * checked and the service role does the work.
 */

export const dynamic = "force-dynamic"

const ON_ZERO: OnZero[] = ["hide", "hold", "message"]

function withService() {
  try {
    return { ok: true as const, client: serviceClient() }
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

function text(value: unknown, limit: number) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed.slice(0, limit) : null
}

function seconds(value: unknown, fallback: number) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, MAX_DURATION_SECONDS)
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const service = withService()
  if (!service.ok) return service.response

  const { data, error } = await service.client
    .from("obs_timers")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[v0] obs_timers read failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not load the timers.") }, { status: 500 })
  }

  return NextResponse.json({ rows: (data ?? []) as ObsTimerRow[] })
}

/** A new timer, started the moment it is created. */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })

  const message = text(body.message, 120)
  if (!message) return NextResponse.json({ error: "A timer needs a label." }, { status: 400 })

  const duration = seconds(body.duration_seconds, 0)
  if (!duration) return NextResponse.json({ error: "A timer needs a length." }, { status: 400 })

  const onZero = ON_ZERO.includes(body.on_zero as OnZero) ? (body.on_zero as OnZero) : "hide"

  const service = withService()
  if (!service.ok) return service.response

  // Append. Reading the current maximum rather than counting rows, so a gap
  // left by a deletion does not put the new timer on top of an existing one.
  const { data: last } = await service.client
    .from("obs_timers")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = {
    id: crypto.randomUUID(),
    message,
    duration_seconds: duration,
    end_time: new Date(Date.now() + duration * 1000).toISOString(),
    paused_remaining_seconds: null,
    on_zero: onZero,
    zero_message: onZero === "message" ? text(body.zero_message, 60) : null,
    sort_order: (Number(last?.sort_order) || 0) + 1,
    active: true,
    bold_icon: body.bold_icon !== false,
    bold_message: body.bold_message === true,
    bold_time: body.bold_time !== false,
    data_url: text(body.data_url, 200_000),
  }

  const { data, error } = await service.client.from("obs_timers").insert(row).select("*").maybeSingle()

  if (error) {
    console.error("[v0] obs_timers insert failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not add the timer.") }, { status: 500 })
  }

  return NextResponse.json({ row: data as ObsTimerRow })
}

/**
 * Edits and control-button presses, both.
 *
 * A press sends `action` and nothing else; the maths for what it changes
 * lives in lib/obs-timers.ts so the widget reads a row the same way this
 * writes one.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof body?.id === "string" ? body.id : null
  if (!body || !id) return NextResponse.json({ error: "Which timer?" }, { status: 400 })

  const service = withService()
  if (!service.ok) return service.response

  let patch: Record<string, unknown> = {}

  if (typeof body.action === "string") {
    const { data: current, error: readError } = await service.client
      .from("obs_timers")
      .select("end_time, paused_remaining_seconds, duration_seconds")
      .eq("id", id)
      .maybeSingle()

    if (readError || !current) {
      return NextResponse.json({ error: "That timer is gone." }, { status: 404 })
    }

    const action = body.action as TimerAction["action"]
    if (action === "extend") {
      const by = Math.round(Number(body.seconds))
      if (!Number.isFinite(by) || by === 0) {
        return NextResponse.json({ error: "Extend by how long?" }, { status: 400 })
      }
      patch = applyTimerAction(current, { action, seconds: by })
    } else if (action === "pause" || action === "resume" || action === "restart") {
      patch = applyTimerAction(current, { action })
    } else {
      return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 })
    }
  } else {
    // A plain edit. Only the fields actually sent are touched, so toggling
    // one thing cannot blank another.
    if ("message" in body) {
      const message = text(body.message, 120)
      if (!message) return NextResponse.json({ error: "A timer needs a label." }, { status: 400 })
      patch.message = message
    }
    if ("active" in body) patch.active = body.active === true
    if ("duration_seconds" in body) patch.duration_seconds = seconds(body.duration_seconds, 300)
    if ("sort_order" in body) patch.sort_order = Math.round(Number(body.sort_order)) || 0
    if ("data_url" in body) patch.data_url = text(body.data_url, 200_000)
    if ("bold_icon" in body) patch.bold_icon = body.bold_icon === true
    if ("bold_message" in body) patch.bold_message = body.bold_message === true
    if ("bold_time" in body) patch.bold_time = body.bold_time === true
    if ("on_zero" in body) {
      const onZero = ON_ZERO.includes(body.on_zero as OnZero) ? (body.on_zero as OnZero) : "hide"
      patch.on_zero = onZero
      patch.zero_message = onZero === "message" ? text(body.zero_message, 60) : null
    } else if ("zero_message" in body) {
      patch.zero_message = text(body.zero_message, 60)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 })
    }
  }

  const { data, error } = await service.client
    .from("obs_timers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    console.error("[v0] obs_timers update failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not save the timer.") }, { status: 500 })
  }

  return NextResponse.json({ row: data as ObsTimerRow })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Which timer?" }, { status: 400 })

  const service = withService()
  if (!service.ok) return service.response

  const { error } = await service.client.from("obs_timers").delete().eq("id", id)

  if (error) {
    console.error("[v0] obs_timers delete failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not remove the timer.") }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
