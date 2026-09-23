import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { explainDbError } from "@/lib/now-playing"

/**
 * The info lines on the top bar — the "!WIN: …" row and anything like it.
 *
 * Same story as the timers: written straight from the browser with the public
 * anon key, against a table that never had row-level security switched on at
 * all. Migration 068 enables it with a read-only policy, and writes come
 * through here behind the admin session.
 */

export const dynamic = "force-dynamic"

export type ObsInfoRow = {
  id: string
  message: string
  active: boolean
  sort_order: number
  word_styles: WordStyle[] | null
  data_url: string | null
}

export type WordStyle = { index: number; bold?: boolean; italic?: boolean; underline?: boolean }

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

/**
 * Keeps only styles that point at a word the message actually has.
 *
 * Editing a line shorter used to leave styles pointing past its end, which
 * the widget then looked up for every word and never found.
 */
function readWordStyles(value: unknown, message: string): WordStyle[] {
  if (!Array.isArray(value)) return []
  const words = message.split(" ").length
  const seen = new Set<number>()
  const out: WordStyle[] = []
  for (const entry of value) {
    const index = Math.round(Number((entry as WordStyle)?.index))
    if (!Number.isInteger(index) || index < 0 || index >= words || seen.has(index)) continue
    const style = entry as WordStyle
    if (!style.bold && !style.italic && !style.underline) continue
    seen.add(index)
    out.push({ index, bold: !!style.bold, italic: !!style.italic, underline: !!style.underline })
  }
  return out
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const service = withService()
  if (!service.ok) return service.response

  const { data, error } = await service.client
    .from("obs_info")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[v0] obs_info read failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not load the info lines.") }, { status: 500 })
  }

  return NextResponse.json({ rows: (data ?? []) as ObsInfoRow[] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const message = text(body?.message, 200)
  if (!message) return NextResponse.json({ error: "An info line needs some text." }, { status: 400 })

  const service = withService()
  if (!service.ok) return service.response

  const { data: last } = await service.client
    .from("obs_info")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = {
    id: crypto.randomUUID(),
    message,
    active: true,
    sort_order: (Number(last?.sort_order) || 0) + 1,
    word_styles: readWordStyles(body?.word_styles, message),
    data_url: text(body?.data_url, 200_000),
  }

  const { data, error } = await service.client.from("obs_info").insert(row).select("*").maybeSingle()

  if (error) {
    console.error("[v0] obs_info insert failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not add the info line.") }, { status: 500 })
  }

  return NextResponse.json({ row: data as ObsInfoRow })
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof body?.id === "string" ? body.id : null
  if (!body || !id) return NextResponse.json({ error: "Which info line?" }, { status: 400 })

  const service = withService()
  if (!service.ok) return service.response

  const patch: Record<string, unknown> = {}

  if ("message" in body) {
    const message = text(body.message, 200)
    if (!message) return NextResponse.json({ error: "An info line needs some text." }, { status: 400 })
    patch.message = message
    // Styles are re-read against the new text, so shortening a line drops the
    // styles that pointed at words it no longer has.
    patch.word_styles = readWordStyles(body.word_styles ?? [], message)
  } else if ("word_styles" in body) {
    const { data: current } = await service.client.from("obs_info").select("message").eq("id", id).maybeSingle()
    patch.word_styles = readWordStyles(body.word_styles, String(current?.message ?? ""))
  }

  if ("active" in body) patch.active = body.active === true
  if ("sort_order" in body) patch.sort_order = Math.round(Number(body.sort_order)) || 0
  if ("data_url" in body) patch.data_url = text(body.data_url, 200_000)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 })
  }

  const { data, error } = await service.client
    .from("obs_info")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    console.error("[v0] obs_info update failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not save the info line.") }, { status: 500 })
  }

  return NextResponse.json({ row: data as ObsInfoRow })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Which info line?" }, { status: 400 })

  const service = withService()
  if (!service.ok) return service.response

  const { error } = await service.client.from("obs_info").delete().eq("id", id)

  if (error) {
    console.error("[v0] obs_info delete failed:", error)
    return NextResponse.json({ error: explainDbError(error, "Could not remove the info line.") }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
