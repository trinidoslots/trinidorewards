import crypto from "node:crypto"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"

/**
 * The random slot, for /admin/random.
 *
 * GET  — the providers in the catalogue (for the filter), how many slots
 *        there are, and the last spins.
 * POST — { provider?, withImage?, onlyOnStake? } spins: picks one slot, builds the strip the
 *        reel runs through, and writes a random_slot_spins row. The stream
 *        column animates from that row, so every screen lands on the same slot.
 *
 * Picked here with crypto, not in the browser: the result is decided once,
 * by the server, and the animation only shows it.
 */

export const dynamic = "force-dynamic"

type Row = { game_name: string; provider: string | null; image_url?: string | null }
type ReelEntry = { name: string; provider: string | null; image_url: string | null }

const SPIN_MS = 6500
const REEL_LENGTH = 28
const PAGE = 1000

type Filter = { provider?: string; withImage?: boolean; onlyOnStake?: boolean }

function filtered(filter: Filter, columns: string, count?: "exact") {
  let query = serviceClient()
    .from("slots")
    .select(columns, count ? { count, head: true } : undefined)
  if (filter.provider) query = query.eq("provider", filter.provider)
  if (filter.withImage) query = query.not("image_url", "is", null)
  if (filter.onlyOnStake) query = query.eq("only_on_stake", true)
  return query
}

async function rowAt(filter: Filter, offset: number): Promise<Row | null> {
  // "*" so this works whether or not scripts/077 has added image_url yet.
  const { data } = await filtered(filter, "*").order("id").range(offset, offset)
  return ((data ?? [])[0] as unknown as Row | undefined) ?? null
}

const entry = (row: Row): ReelEntry => ({ name: row.game_name, provider: row.provider ?? null, image_url: row.image_url ?? null })

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const client = serviceClient()

  // Providers, paged: PostgREST returns at most 1000 rows per request.
  const providers = new Map<string, number>()
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await client.from("slots").select("provider").order("id").range(from, from + PAGE - 1)
    if (error || !data?.length) break
    for (const row of data) {
      const name = String(row.provider ?? "").trim()
      if (name) providers.set(name, (providers.get(name) ?? 0) + 1)
    }
    if (data.length < PAGE) break
  }

  const { data: spins } = await client
    .from("random_slot_spins")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10)

  return Response.json({
    total: Array.from(providers.values()).reduce((sum, count) => sum + count, 0),
    providers: Array.from(providers.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    spins: spins ?? [],
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const filter: Filter = {
    provider: typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : undefined,
    withImage: body.withImage === true,
    onlyOnStake: body.onlyOnStake === true,
  }

  const { count, error: countError } = await filtered(filter, "id", "exact")
  if (countError) {
    console.error("[random-slot] count failed:", countError)
    return Response.json({ error: "Could not read the slot catalogue." }, { status: 500 })
  }
  const total = count ?? 0
  if (total === 0) {
    return Response.json({ error: "No slots match – import the Stake catalogue on Edit Slots first." }, { status: 400 })
  }

  // The result, then the slots the reel passes on the way. Duplicates in the
  // strip are fine on a small catalogue; the result is never among them.
  const offsets = [crypto.randomInt(total), ...Array.from({ length: REEL_LENGTH - 1 }, () => crypto.randomInt(total))]
  const rows = await Promise.all(offsets.map((offset) => rowAt(filter, offset)))
  const result = rows[0]
  if (!result) return Response.json({ error: "Could not pick a slot." }, { status: 500 })

  const decoys = rows
    .slice(1)
    .filter((row): row is Row => !!row && row.game_name !== result.game_name)
    .map(entry)
  const reel = [...decoys, entry(result)]

  const { data: spin, error } = await serviceClient()
    .from("random_slot_spins")
    .insert({
      slot_name: result.game_name,
      provider: result.provider ?? null,
      image_url: result.image_url ?? null,
      reel,
      spin_ms: SPIN_MS,
      started_at: new Date().toISOString(),
      created_by: auth.email,
    })
    .select("*")
    .single()

  if (error) {
    console.error("[random-slot] insert failed:", error)
    const missing = error.code === "42P01" || /random_slot_spins/.test(error.message)
    return Response.json(
      { error: missing ? "Run scripts/077_slot_catalogue_and_spins.sql in Supabase first." : "Could not save the spin." },
      { status: 500 },
    )
  }

  return Response.json({ spin, total })
}
