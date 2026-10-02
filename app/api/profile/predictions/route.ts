import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { likeExact } from "@/lib/like"
import type { PredictionResult } from "@/components/profile-predictions"

/**
 * The signed-in user's bonus hunt predictions, for the profile's Predictions
 * tab: every one they made, placed or not, with how close it came.
 *
 * Theirs are the rows with their account id, and rows with no account under
 * their username (guesses made before they had an account). One per hunt:
 * the latest, if there are several.
 *
 * Place is worked out against everyone who predicted the same hunt, by how far
 * each guess is from the final balance (total won); ties share a place. While
 * a hunt runs there is no final balance, so no place, only the count so far.
 */

export const dynamic = "force-dynamic"

/** Most recent hunts shown; a long history is paged by nobody. */
const HUNTS = 50

type PredictionRow = {
  id: string
  hunt_id: string
  user_id: string | null
  username: string
  predicted_end_balance: number | string
  predicted_max_multiplier: number | string | null
  predicted_best_game: string | null
  created_at: string
}

type HuntRow = {
  hunt_id: string
  status: string
  streamer: string | null
  title: string | null
  starting_balance: number | string | null
  total_won: number | string | null
  best_multiplier: number | string | null
  best_multiplier_game: string | null
  created_at: string
  ended_at: string | null
}

const num = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = serviceClient()
  const { data: me } = await client.from("users").select("username").eq("id", session.userId).maybeSingle()
  const username = String(me?.username ?? session.username ?? "").trim()

  const filter = username
    ? `user_id.eq.${session.userId},and(user_id.is.null,username.ilike.${likeExact(username)})`
    : `user_id.eq.${session.userId}`
  const { data: mineRaw, error } = await client
    .from("hunt_predictions")
    .select("id, hunt_id, user_id, username, predicted_end_balance, predicted_max_multiplier, predicted_best_game, created_at")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(HUNTS * 2)
  if (error) {
    console.error("[profile] predictions:", error)
    return NextResponse.json({ error: "Could not load your predictions." }, { status: 500 })
  }

  // ilike only narrows (case aside); the name has to match exactly. Then one per hunt, the latest.
  const lowered = username.toLowerCase()
  const latest = new Map<string, PredictionRow>()
  for (const row of (mineRaw ?? []) as PredictionRow[]) {
    if (row.user_id !== session.userId && row.username.trim().toLowerCase() !== lowered) continue
    if (!latest.has(row.hunt_id)) latest.set(row.hunt_id, row)
  }
  const mine = [...latest.values()].slice(0, HUNTS)
  if (mine.length === 0) return NextResponse.json({ results: [] })

  const huntIds = mine.map((row) => row.hunt_id)
  const [{ data: hunts }, { data: everyone }] = await Promise.all([
    client
      .from("bonus_hunt_kpis")
      .select("hunt_id, status, streamer, title, starting_balance, total_won, best_multiplier, best_multiplier_game, created_at, ended_at")
      .in("hunt_id", huntIds),
    client.from("hunt_predictions").select("id, hunt_id, user_id, username, predicted_end_balance").in("hunt_id", huntIds),
  ])

  const huntById = new Map(((hunts ?? []) as HuntRow[]).map((hunt) => [String(hunt.hunt_id), hunt]))
  const byHunt = new Map<string, PredictionRow[]>()
  for (const row of (everyone ?? []) as PredictionRow[]) {
    byHunt.set(row.hunt_id, [...(byHunt.get(row.hunt_id) ?? []), row])
  }

  const results: PredictionResult[] = []
  for (const prediction of mine) {
    const hunt = huntById.get(String(prediction.hunt_id))
    // A hunt that was reset is gone, and so is anything to compare with.
    if (!hunt) continue

    const guess = num(prediction.predicted_end_balance) ?? 0
    const ended = hunt.status === "ended"
    const final = ended ? num(hunt.total_won) : null
    const all = byHunt.get(prediction.hunt_id) ?? [prediction]

    let place: number | null = null
    let top: PredictionResult["top"] = []
    if (final != null) {
      const ranked = all
        .map((row) => ({ row, distance: Math.abs((num(row.predicted_end_balance) ?? 0) - final) }))
        .sort((a, b) => a.distance - b.distance)
      const myDistance = Math.abs(guess - final)
      place = 1 + ranked.filter((entry) => entry.distance < myDistance).length
      top = ranked.slice(0, 3).map(({ row }) => ({
        username: row.username,
        guess: num(row.predicted_end_balance) ?? 0,
        you: row.id === prediction.id,
      }))
    }

    const name = [hunt.streamer, hunt.title].filter(Boolean).join(" · ") || "Bonus hunt"
    results.push({
      id: prediction.id,
      huntId: String(prediction.hunt_id),
      huntName: name,
      streamer: hunt.streamer ?? "",
      predictedAt: prediction.created_at,
      guess,
      guessMulti: num(prediction.predicted_max_multiplier),
      guessGame: prediction.predicted_best_game?.trim() || null,
      hunt: {
        status: ended ? "ended" : "running",
        startingBalance: num(hunt.starting_balance) ?? 0,
        finalBalance: final,
        bestMulti: num(hunt.best_multiplier) || null,
        bestGame: hunt.best_multiplier_game?.trim() || null,
        endedAt: hunt.ended_at,
      },
      place,
      of: all.length,
      top,
    })
  }

  return NextResponse.json({ results })
}
