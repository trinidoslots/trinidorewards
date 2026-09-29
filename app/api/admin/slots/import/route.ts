import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { parseImport } from "@/lib/slots"

/**
 * Imports the Stake catalogue file made by the script on /admin/slots.
 *
 * Upserts on (game_name, provider), so importing again later adds the new
 * releases and refreshes the artwork of the ones already there, without
 * doubling anything. Slots typed in by hand are never deleted by an import.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BATCH = 500

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let parsed
  try {
    parsed = parseImport(await request.json())
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Unreadable file" }, { status: 400 })
  }
  if (parsed.slots.length === 0) return Response.json({ error: "The file has no slots in it." }, { status: 400 })

  const client = serviceClient()
  const now = new Date().toISOString()
  let written = 0

  for (let start = 0; start < parsed.slots.length; start += BATCH) {
    const rows = parsed.slots.slice(start, start + BATCH).map((slot) => ({
      game_name: slot.name,
      provider: slot.provider,
      image_url: slot.image,
      stake_slug: slot.slug,
      source: "stake",
      updated_at: now,
    }))
    const { error } = await client.from("slots").upsert(rows, { onConflict: "game_name,provider" })
    if (error) {
      console.error("[slots] import batch failed:", error)
      const missing = error.code === "42703" || error.code === "PGRST204" || /image_url|stake_slug|source/.test(error.message)
      return Response.json(
        {
          error: missing
            ? "The slots table is missing the new columns – run scripts/077_slot_catalogue_and_spins.sql in Supabase."
            : `Import stopped after ${written} slots: ${error.message}`,
          written,
        },
        { status: 500 },
      )
    }
    written += rows.length
  }

  console.log(`[slots] ${auth.email} imported ${written} slots from Stake`)
  return Response.json({ written, skipped: parsed.skipped })
}
