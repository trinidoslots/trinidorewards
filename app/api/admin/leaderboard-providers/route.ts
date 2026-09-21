import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { PROVIDER_COLUMNS } from "@/lib/leaderboard-provider-store"
import {
  configFromRow,
  maskKey,
  DEFAULT_CONFIG,
  isDateFormat,
  type ProviderConfig,
  type ProviderRow,
} from "@/lib/leaderboard-provider"
import { fetchStandingsWithRef, LeaderboardApiError } from "@/lib/leaderboard-api"

/**
 * Managing the wager feeds.
 *
 * Every method is admin-only and goes through the service client, because
 * leaderboard_providers has RLS on and no policy — the browser's anon key
 * cannot see the table at all. That is what makes it safe to keep the keys
 * there rather than in environment variables.
 *
 * The key is never sent back. A listing carries api_key_preview, which is the
 * first and last four characters; saving with an empty key keeps the stored
 * one, so editing a provider's paths does not require retyping its secret.
 */

export const dynamic = "force-dynamic"

/** Fields the client may set, and what they are called in the table. */
const WRITABLE = [
  "name",
  "base_url",
  "auth_header",
  "auth_scheme",
  "start_param",
  "end_param",
  "limit_param",
  "date_format",
  "max_limit",
  "max_range_days",
  "cache_minutes",
  "rows_path",
  "username_path",
  "score_path",
  "score_divisor",
  "avatar_path",
  "ref_path",
  "success_path",
  "is_active",
] as const

/** Whole numbers. */
const NUMERIC = new Set(["max_limit", "max_range_days", "cache_minutes"])
/** Not truncated: a divisor could legitimately be 1.5 or 0.01. */
const DECIMAL = new Set(["score_divisor"])
const BOOLEAN = new Set(["is_active"])
/** Legitimately empty: "" on rows_path describes a bare-array response. */
const MAY_BE_EMPTY = new Set(["rows_path"])

function readPatch(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  for (const field of WRITABLE) {
    if (!(field in body)) continue
    const value = body[field]

    if (BOOLEAN.has(field)) {
      patch[field] = value === true
      continue
    }
    if (NUMERIC.has(field)) {
      const parsed = Math.trunc(Number(value))
      if (Number.isFinite(parsed) && parsed > 0) patch[field] = parsed
      continue
    }
    if (DECIMAL.has(field)) {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed > 0) patch[field] = parsed
      continue
    }
    if (typeof value !== "string") continue

    const trimmed = value.trim()
    // An empty string clears an optional field; for the few that are meaningful
    // when empty it is stored as given.
    patch[field] = trimmed || (MAY_BE_EMPTY.has(field) ? "" : null)
  }

  if (typeof patch.date_format === "string" && !isDateFormat(patch.date_format)) {
    delete patch.date_format
  }
  return patch
}

/** One row as the admin panel sees it: everything except the key itself. */
function present(row: ProviderRow & { is_active?: boolean }) {
  const { api_key: _key, ...rest } = row
  return { ...rest, api_key_preview: maskKey(row.api_key) }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = serviceClient()
  const { data, error } = await supabase
    .from("leaderboard_providers")
    .select(`${PROVIDER_COLUMNS}, is_active, created_at`)
    .order("name")

  if (error) {
    console.error("[providers] list failed:", error.message)
    return Response.json({ error: "Could not load the providers." }, { status: 500 })
  }

  return Response.json({
    providers: (data ?? []).map((row: ProviderRow) => present(row)),
    defaults: DEFAULT_CONFIG,
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  // A trial run against the feed, so the paths can be got right here rather
  // than by reading deployment logs after every guess.
  if (body.action === "test") return test(body)

  const patch = readPatch(body)
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : ""

  if (!patch.name) return Response.json({ error: "A name is required." }, { status: 400 })
  if (!patch.base_url) return Response.json({ error: "An address is required." }, { status: 400 })
  if (!apiKey) return Response.json({ error: "An API key is required." }, { status: 400 })

  const supabase = serviceClient()
  const { data, error } = await supabase
    .from("leaderboard_providers")
    .insert([{ ...patch, api_key: apiKey }])
    .select(`${PROVIDER_COLUMNS}, is_active, created_at`)
    .single()

  if (error) {
    console.error("[providers] create failed:", error.message)
    const duplicate = error.code === "23505"
    return Response.json(
      { error: duplicate ? "A provider with that name already exists." : "Could not save that provider." },
      { status: duplicate ? 409 : 500 },
    )
  }

  return Response.json({ provider: present(data as ProviderRow) })
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = typeof body.id === "string" ? body.id : ""
  if (!id) return Response.json({ error: "id is required" }, { status: 400 })

  const patch = readPatch(body)
  // Only replace the key when a new one was actually typed. Otherwise editing a
  // path would mean retyping a secret nobody can read back.
  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : ""
  if (apiKey) patch.api_key = apiKey
  patch.updated_at = new Date().toISOString()

  const supabase = serviceClient()
  const { data, error } = await supabase
    .from("leaderboard_providers")
    .update(patch)
    .eq("id", id)
    .select(`${PROVIDER_COLUMNS}, is_active, created_at`)
    .single()

  if (error) {
    console.error("[providers] update failed:", error.message)
    return Response.json({ error: "Could not save that provider." }, { status: 500 })
  }

  return Response.json({ provider: present(data as ProviderRow) })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return Response.json({ error: "id is required" }, { status: 400 })

  const supabase = serviceClient()
  // Boards pointing at it fall back to the environment rather than breaking:
  // provider_id is ON DELETE SET NULL.
  const { error } = await supabase.from("leaderboard_providers").delete().eq("id", id)

  if (error) {
    console.error("[providers] delete failed:", error.message)
    return Response.json({ error: "Could not delete that provider." }, { status: 500 })
  }

  return Response.json({ ok: true })
}

/**
 * Fetches one small window and reports what came back.
 *
 * Takes the form's current values rather than a saved row, so a provider can be
 * tried before it is stored. A saved provider is tested by passing its id and
 * leaving api_key empty — the stored key is used and still never returned.
 */
async function test(body: Record<string, unknown>) {
  const patch = readPatch(body)
  let apiKey = typeof body.api_key === "string" ? body.api_key.trim() : ""

  if (!apiKey && typeof body.id === "string" && body.id) {
    const supabase = serviceClient()
    const { data } = await supabase
      .from("leaderboard_providers")
      .select("api_key")
      .eq("id", body.id)
      .maybeSingle()
    apiKey = (data as { api_key?: string } | null)?.api_key ?? ""
  }

  if (!patch.base_url) return Response.json({ error: "An address is required." }, { status: 400 })
  if (!apiKey) return Response.json({ error: "An API key is required." }, { status: 400 })

  const row = {
    id: "test",
    name: String(patch.name ?? "Test"),
    base_url: String(patch.base_url),
    api_key: apiKey,
    auth_header: (patch.auth_header as string) ?? null,
    auth_scheme: (patch.auth_scheme as string) ?? null,
    start_param: (patch.start_param as string) ?? null,
    end_param: (patch.end_param as string) ?? null,
    limit_param: (patch.limit_param as string) ?? null,
    date_format: (patch.date_format as string) ?? null,
    max_limit: (patch.max_limit as number) ?? null,
    max_range_days: (patch.max_range_days as number) ?? null,
    cache_minutes: (patch.cache_minutes as number) ?? null,
    rows_path: patch.rows_path === undefined ? null : (patch.rows_path as string),
    username_path: (patch.username_path as string) ?? null,
    score_path: (patch.score_path as string) ?? null,
    score_divisor: (patch.score_divisor as number) ?? null,
    avatar_path: (patch.avatar_path as string) ?? null,
    ref_path: (patch.ref_path as string) ?? null,
    success_path: (patch.success_path as string) ?? null,
  } satisfies ProviderRow

  const config: ProviderConfig = configFromRow(row)

  // Seven days ending now, which is inside every provider's range limit.
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - 7 * 86_400_000).toISOString()

  try {
    const rows = await fetchStandingsWithRef(config, { startDate, endDate, limit: 5 })
    return Response.json({
      ok: true,
      found: rows.length,
      // Already masked, and the account id is the one thing worth showing to
      // confirm ref_path points somewhere real.
      sample: rows.slice(0, 3).map((row) => ({
        rank: row.rank,
        username: row.username,
        score: row.score,
        hasAvatar: row.avatar !== null,
        hasRef: row.ref !== null,
      })),
      window: { startDate, endDate },
    })
  } catch (problem) {
    const message = problem instanceof LeaderboardApiError ? problem.message : "The test request failed."
    return Response.json({ ok: false, error: message }, { status: 200 })
  }
}
