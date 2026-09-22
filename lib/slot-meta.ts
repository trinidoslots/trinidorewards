import { LIMITS, cleanText, mergeWithKnown, nameKey, type NowPlayingRow } from "@/lib/now-playing"

/**
 * What we remember about each slot, and how a "now playing" is resolved.
 *
 * Server-only: every function here takes a service-role client, because
 * slot_meta and now_playing have no write policy and hunt_bonuses is not
 * something the overlay should be reading directly.
 *
 * The shape of it:
 *
 *   1. whatever the caller could see  (a scrape, or a form)
 *   2. + what slot_meta remembers about this game        <- fills the gaps
 *   3. + the best win, from slot_meta or from the hunts  <- computed
 *   4. -> written back to slot_meta, so next time step 2 knows more
 *   5. -> written to now_playing, which is all the overlay reads
 *
 * Step 4 is what makes the bar get better the more you use it.
 */

export type SlotMetaRow = {
  name_key: string
  slot_name: string
  provider: string | null
  max_win: string | null
  badge: string | null
  image_url: string | null
  best_win: number | null
  updated_at: string
}

/** Minimal shape of the supabase client, so this file needs no generated types. */
type Db = {
  from: (table: string) => any
}

export async function readSlotMeta(db: Db, slotName: string): Promise<SlotMetaRow | null> {
  const key = nameKey(slotName)
  if (!key) return null
  const { data, error } = await db.from("slot_meta").select("*").eq("name_key", key).maybeSingle()
  if (error) {
    // A missing table here must not stop the bar being set — the game still
    // goes up, just without the remembered fields.
    console.error("[v0] slot_meta read failed:", error)
    return null
  }
  return (data ?? null) as SlotMetaRow | null
}

/**
 * The biggest payout ever recorded for this game across every hunt.
 *
 * `result` is what a bonus actually paid, and is null until the bonus has been
 * opened, so unopened entries drop out on their own.
 */
export async function bestWinFromHunts(db: Db, slotName: string): Promise<number | null> {
  const name = (slotName ?? "").trim()
  if (!name) return null

  const { data, error } = await db
    .from("hunt_bonuses")
    .select("game_name, result")
    .ilike("game_name", name)
    .not("result", "is", null)
    .order("result", { ascending: false })
    .limit(1)

  if (error) {
    console.error("[v0] best win lookup failed:", error)
    return null
  }

  const top = (data ?? [])[0]
  const value = Number(top?.result)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Writes back what we now know, so the next lookup is richer. */
export async function rememberSlot(
  db: Db,
  fields: {
    slot_name: string
    provider: string | null
    max_win: string | null
    badge: string | null
    image_url: string | null
    best_win?: number | null
  },
): Promise<void> {
  const key = nameKey(fields.slot_name)
  if (!key) return

  // Only non-null values are written. A scrape that missed the badge must not
  // erase a badge we already knew — that would make the table forget things
  // every time the page rendered slowly.
  const patch: Record<string, unknown> = {
    name_key: key,
    slot_name: cleanText(fields.slot_name, LIMITS.slotName) ?? fields.slot_name,
    updated_at: new Date().toISOString(),
  }
  for (const field of ["provider", "max_win", "badge", "image_url"] as const) {
    if (fields[field] != null) patch[field] = fields[field]
  }
  // best_win is the exception: it is an explicit admin override, so an explicit
  // null clears it back to "work it out from the hunts".
  if (fields.best_win !== undefined) patch.best_win = fields.best_win

  const { error } = await db.from("slot_meta").upsert(patch, { onConflict: "name_key" })
  if (error) console.error("[v0] slot_meta write failed:", error)
}

/**
 * Turns whatever a caller could see into the full row the overlay renders.
 *
 * `bestWinOverride` is only passed by the admin form; undefined means "leave
 * whatever is stored alone", null means "clear the override".
 */
export async function resolveNowPlaying(
  db: Db,
  scraped: Omit<NowPlayingRow, "id" | "updated_at" | "best_win">,
  bestWinOverride?: number | null,
): Promise<Omit<NowPlayingRow, "id" | "updated_at">> {
  const slotName = scraped.slot_name ?? ""
  const known = await readSlotMeta(db, slotName)
  const merged = mergeWithKnown(scraped, known)

  // A typed figure wins; otherwise a previously typed one; otherwise the hunts.
  const stored = bestWinOverride !== undefined ? bestWinOverride : (known?.best_win ?? null)
  const best = stored ?? (await bestWinFromHunts(db, slotName))

  await rememberSlot(db, {
    slot_name: slotName,
    provider: merged.provider,
    max_win: merged.max_win,
    badge: merged.badge,
    image_url: merged.image_url,
    ...(bestWinOverride !== undefined ? { best_win: bestWinOverride } : null),
  })

  return { ...merged, best_win: best }
}
