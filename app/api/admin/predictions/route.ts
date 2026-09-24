import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/admin-guard"
import { getActiveHunt } from "@/lib/active-hunt"

function serviceClient() {
  // The URL and key MUST come from the same Supabase project. Never mix a
  // HUNT_-prefixed var with a non-prefixed one (or vice versa) — that pairs
  // one project's URL with another project's key and fails with "Invalid API key".
  return createSupabaseClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.HUNT_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function currentHuntId(client: ReturnType<typeof serviceClient>, requested?: string | null) {
  if (requested) return requested
  const hunt = await getActiveHunt(client)
  return hunt?.id ?? null
}

export async function GET(request: Request) {
  const client = serviceClient()
  const huntId = await currentHuntId(client, new URL(request.url).searchParams.get("hunt_id"))
  if (!huntId) return Response.json({ window: null, predictions: [], hunt: null })
  const [{ data: window }, { data: predictions }, { data: hunt }] = await Promise.all([
    client.from("prediction_windows").select("hunt_id,status,opens_at,closes_at").eq("hunt_id", huntId).maybeSingle(),
    client.from("hunt_predictions").select("*").eq("hunt_id", huntId).order("created_at", { ascending: false }),
    client.from("bonus_hunt_kpis").select("hunt_id,starting_balance,opening_balance,total_won,best_multiplier,best_cash_win_game,current_balance").eq("hunt_id", huntId).maybeSingle(),
  ])
  const liveWindow = window ?? { hunt_id: huntId, status: "closed", opens_at: null, closes_at: null }

  let bestGameImage: string | null = null
  if (hunt?.best_cash_win_game) {
    const { data: bestBonus } = await client
      .from("hunt_bonuses")
      .select("image_url")
      .eq("hunt_id", huntId)
      .ilike("game_name", hunt.best_cash_win_game)
      .not("image_url", "is", null)
      .limit(1)
      .maybeSingle()
    bestGameImage = bestBonus?.image_url ?? null
  }

  // "Final balance" here means the amount won (the KPI's total_won), not the
  // casino balance (which would also include the untouched starting balance).
  return Response.json({ window: liveWindow, predictions: predictions ?? [], hunt: hunt ? { ...hunt, best_cash_win_image: bestGameImage } : hunt, settings: { predictions_enabled: liveWindow.status === "open", predictions_start_time: liveWindow.opens_at, predictions_end_time: liveWindow.closes_at, actual_highest_multi: hunt?.best_multiplier ?? null, actual_final_balance: hunt?.total_won == null ? null : Number(hunt.total_won), actual_best_game: hunt?.best_cash_win_game ?? null, actual_best_game_image: bestGameImage } })
}

export async function POST(request: Request) {
  // Opening, closing and resetting predictions. Anyone could, before.
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const client = serviceClient()
  const huntId = await currentHuntId(client, body.hunt_id)
  if (!huntId) return Response.json({ error: "No active hunt found" }, { status: 400 })
  if (body.action === "open") {
    const now = new Date()
    const closes = new Date(now.getTime() + 5 * 60 * 1000)
    const { error } = await client.from("prediction_windows").upsert({ hunt_id: huntId, status: "open", opens_at: now.toISOString(), closes_at: closes.toISOString() }, { onConflict: "hunt_id" })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, closes_at: closes.toISOString() })
  }
  if (body.action === "close") {
    const { error } = await client.from("prediction_windows").update({ status: "closed" }).eq("hunt_id", huntId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }
  if (body.reset === true) {
    const { error } = await client.from("hunt_predictions").delete().eq("hunt_id", huntId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }
  return Response.json({ error: "Unsupported prediction action" }, { status: 405 })
}
