import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { getSiteSession } from "@/lib/site-session"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const username = (await getSiteSession())?.username

    if (!username) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { hunt_id, highest_multi, best_game, final_balance } = body

    // Validate required fields
    const multiplier = Number(highest_multi)
    const balance = Number(final_balance)
    if (!hunt_id || !best_game || !Number.isFinite(multiplier) || multiplier < 0 || !Number.isFinite(balance)) {
      return NextResponse.json({ error: "Enter a valid multiplier, final balance, and best game." }, { status: 400 })
    }

    // The URL and key MUST come from the same Supabase project. Never mix a
    // HUNT_-prefixed var with a non-prefixed one (or vice versa) — that pairs
    // one project's URL with another project's key and fails with "Invalid API key".
    const supabase = createSupabaseClient(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.HUNT_SUPABASE_URL)!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY)!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // The `enforce_open_prediction_trigger` on hunt_predictions is the single
    // source of truth for whether the prediction window is open — it rejects
    // the insert/update with "Predictions are closed for this round" unless
    // prediction_windows.status = 'open' and now() < closes_at. We don't
    // duplicate that check here; we just translate the DB's rejection below,
    // so the API and the DB can never disagree.

    // Check if user already submitted a prediction for this hunt
    const { data: existingPrediction } = await supabase
      .from("hunt_predictions")
      .select("id")
      .eq("hunt_id", hunt_id)
      .eq("username", username)
      .maybeSingle()

    if (existingPrediction) {
      // Update existing prediction
      const { data, error } = await supabase
        .from("hunt_predictions")
        .update({
          predicted_max_multiplier: multiplier,
          predicted_best_game: best_game,
          predicted_end_balance: balance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPrediction.id)
        .select()
        .single()

      if (error) {
        if (error.message?.includes("Predictions are closed")) {
          return NextResponse.json({ error: "Predictions are closed for this round" }, { status: 400 })
        }
        console.error("[v0] Error updating prediction:", error)
        return NextResponse.json({ error: "Failed to update prediction" }, { status: 500 })
      }

      return NextResponse.json({ data, message: "Prediction updated successfully" })
    } else {
      // Create new prediction
      const { data, error } = await supabase
        .from("hunt_predictions")
        .insert([
          {
            hunt_id,
            username,
            predicted_max_multiplier: multiplier,
            predicted_best_game: best_game,
            predicted_end_balance: balance,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) {
        if (error.message?.includes("Predictions are closed")) {
          return NextResponse.json({ error: "Predictions are closed for this round" }, { status: 400 })
        }
        console.error("[v0] Error creating prediction:", error)
        return NextResponse.json({ error: "Failed to create prediction" }, { status: 500 })
      }

      return NextResponse.json({ data, message: "Prediction submitted successfully" }, { status: 201 })
    }
  } catch (error) {
    console.error("[v0] Prediction API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
