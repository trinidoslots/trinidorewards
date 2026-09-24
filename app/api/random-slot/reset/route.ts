import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"

/**
 * Clears the random-slot display once its result has been shown.
 *
 * The /random-slot page did this itself, writing random_slot_state with the
 * anon key, which meant anyone could write anything into that row. Now the
 * page asks, and the only thing this does is the one reset it needs: blank a
 * finished result that has been up for a while. It cannot set a slot, cannot
 * touch a roll in progress, and cannot wipe a result that has just landed.
 */

/** The page resets ten seconds after the result lands; this leaves a margin. */
const MIN_SHOWN_MS = 8_000

export async function POST() {
  const client = serviceClient()
  const { data: state, error } = await client
    .from("random_slot_state")
    .select("is_rolling, final_slot_name, updated_at")
    .eq("id", 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: "Could not read the state" }, { status: 500 })
  if (!state?.final_slot_name || state.is_rolling) return NextResponse.json({ reset: false })

  const shownFor = Date.now() - Date.parse(state.updated_at ?? "")
  if (!Number.isFinite(shownFor) || shownFor < MIN_SHOWN_MS) return NextResponse.json({ reset: false })

  const { error: updateError } = await client
    .from("random_slot_state")
    .update({
      final_slot_name: null,
      final_slot_provider: null,
      current_slot_name: null,
      current_slot_provider: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .eq("is_rolling", false)

  if (updateError) return NextResponse.json({ error: "Could not reset" }, { status: 500 })
  return NextResponse.json({ reset: true })
}
