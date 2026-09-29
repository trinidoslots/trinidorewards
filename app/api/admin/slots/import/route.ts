import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { importKind, parseImport } from "@/lib/slots"

/**
 * Imports a file made by one of the scripts on /admin/slots.
 *
 * The whole slot list: upserts on (game_name, provider), so importing again
 * later adds the new releases and refreshes the artwork of the ones already
 * there, without doubling anything. Slots typed in by hand are never deleted.
 *
 * The "Only on Stake" list: the same upsert, with the tag set — so an
 * exclusive that was not in the catalogue yet is added — and then the tag is
 * taken off every slot that is no longer in the list. The list is Stake's own
 * group, so it is complete; a game that stopped being exclusive loses the tag.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BATCH = 500

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let raw: unknown
  let parsed
  try {
    raw = await request.json()
    parsed = parseImport(raw)
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Unreadable file" }, { status: 400 })
  }
  if (parsed.slots.length === 0) return Response.json({ error: "The file has no slots in it." }, { status: 400 })

  const exclusives = importKind(raw) === "only-on-stake"
  const client = serviceClient()
  const now = new Date().toISOString()
  const taggedIds: number[] = []
  let written = 0

  const explain = (error: { code?: string; message: string }) => {
    const missing =
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /image_url|stake_slug|source|only_on_stake/.test(error.message)
    if (!missing) return `Import stopped after ${written} slots: ${error.message}`
    return exclusives && /only_on_stake/.test(error.message)
      ? "The slots table has no only_on_stake column yet – run scripts/078_only_on_stake.sql in Supabase."
      : "The slots table is missing the new columns – run scripts/077_slot_catalogue_and_spins.sql in Supabase."
  }

  for (let start = 0; start < parsed.slots.length; start += BATCH) {
    const rows = parsed.slots.slice(start, start + BATCH).map((slot) => ({
      game_name: slot.name,
      provider: slot.provider,
      image_url: slot.image,
      stake_slug: slot.slug,
      source: "stake",
      updated_at: now,
      ...(exclusives ? { only_on_stake: true } : {}),
    }))
    const { data, error } = await client
      .from("slots")
      .upsert(rows, { onConflict: "game_name,provider" })
      .select("id")
    if (error) {
      console.error("[slots] import batch failed:", error)
      return Response.json({ error: explain(error), written }, { status: 500 })
    }
    written += rows.length
    if (exclusives) taggedIds.push(...(data ?? []).map((row: { id: number }) => row.id))
  }

  let untagged = 0
  if (exclusives && taggedIds.length > 0) {
    const { data, error } = await client
      .from("slots")
      .update({ only_on_stake: false, updated_at: now })
      .eq("only_on_stake", true)
      .not("id", "in", `(${taggedIds.join(",")})`)
      .select("id")
    if (error) console.error("[slots] clearing old exclusives failed:", error)
    else untagged = (data ?? []).length
  }

  console.log(
    `[slots] ${auth.email} imported ${written} ${exclusives ? "Only on Stake" : ""} slots from Stake${untagged ? `, ${untagged} lost the tag` : ""}`,
  )
  return Response.json({ written, skipped: parsed.skipped, kind: exclusives ? "only-on-stake" : "catalogue", untagged })
}
