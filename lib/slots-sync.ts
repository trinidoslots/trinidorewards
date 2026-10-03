import { formatProvider } from "@/lib/providers"
import { tidyProviders } from "@/lib/slots-tidy"

/**
 * Keeps the Stake catalogue (the `slots` table) current without the console
 * script: once a day, the slots Stake added recently are read from
 * bonushunt.gg's public API and upserted exactly like the manual import —
 * on (game_name, provider), so nothing doubles and nothing is deleted. The
 * manual import on /admin/slots stays the way to load the full list.
 *
 * Two feeds, both public and keyless (checked 2026-10-03):
 *
 *   /api/public/slots/updates?casino=stake&tab=added&limit=96&offset=N
 *     The catalogue-changes feed: every slot Stake added in the last 7 days,
 *     paged (hasMore). 30 requests/min per IP, edge-cached 5 min. A week is
 *     ~250 slots, so three pages.
 *   /api/public/slots/recent
 *     The newest slots per casino, no rate limit. Carries onlyOnStake, which
 *     the changes feed does not — used to set the tag on new exclusives.
 *
 * Either feed alone is enough to keep up; if one fails the other still runs.
 * The Only on Stake tag is only ever SET here. Taking it off stays with the
 * manual exclusives import, which has the complete group to compare against.
 */

type Db = { from: (table: string) => any }

const BASE = "https://bonushunt.gg/api/public"
const CHANGES_PAGE = 96
const MAX_CHANGES_PAGES = 10 // 960 slots — far beyond a week of Stake releases
export const SYNC_SETTINGS_KEY = "slots_sync"

export type SlotSyncResult = {
  at: string
  ok: boolean
  trigger: "cron" | "admin"
  /** Distinct Stake slots the feeds returned. */
  found: number
  /** Rows upserted (new or refreshed). */
  written: number
  /** Of those, how many were not in the catalogue before. */
  added: number
  newSlots: string[]
  feeds: { changes: string; recent: string }
  error?: string
}

type FeedSlot = { name: string; provider: string; slug: string | null; image: string | null; onlyOnStake: boolean }

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null
  const text = value.replace(/\s+/g, " ").trim()
  return text && text.length <= max ? text : null
}

function httpsUrl(value: unknown): string | null {
  const text = clean(value, 600)
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

/** "https://stake.com/casino/games/massive-bonsai-banzai" -> "massive-bonsai-banzai", the slug the manual import stores. */
function stakeSlug(url: unknown): string | null {
  const text = typeof url === "string" ? url : ""
  const match = text.match(/\/casino\/games\/([^/?#]+)/)
  return match ? clean(decodeURIComponent(match[1]), 200) : null
}

function toFeedSlot(item: Record<string, unknown>, onlyOnStake: boolean): FeedSlot | null {
  const name = clean(item.slotName ?? item.name, 200)
  if (!name) return null
  return {
    name,
    provider: formatProvider(clean(item.provider, 100)) ?? "Unknown",
    slug: stakeSlug(item.url),
    image: httpsUrl(item.image),
    onlyOnStake,
  }
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TrinidoRewards slot sync (trinidorewards.com)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).pathname}`)
  return res.json()
}

async function readChanges(): Promise<FeedSlot[]> {
  const out: FeedSlot[] = []
  for (let page = 0; page < MAX_CHANGES_PAGES; page++) {
    const json = await getJson(`${BASE}/slots/updates?casino=stake&tab=added&limit=${CHANGES_PAGE}&offset=${page * CHANGES_PAGE}`)
    const items: Record<string, unknown>[] = Array.isArray(json?.items) ? json.items : []
    for (const item of items) {
      // The filter is server-side, but the field says it outright — trust that.
      const casinos = Array.isArray(item.casinos) ? item.casinos : []
      if (casinos.length && !casinos.includes("stake")) continue
      const slot = toFeedSlot(item, false)
      if (slot) out.push(slot)
    }
    if (!json?.hasMore || items.length === 0) break
  }
  return out
}

async function readRecent(): Promise<FeedSlot[]> {
  const json = await getJson(`${BASE}/slots/recent`)
  const items: Record<string, unknown>[] = Array.isArray(json?.slotsByCasino?.stake) ? json.slotsByCasino.stake : []
  return items.map((item) => toFeedSlot(item, item.onlyOnStake === true)).filter((s): s is FeedSlot => s !== null)
}

const keyOf = (s: { name: string; provider: string }) => `${s.name.toLowerCase()}|${s.provider.toLowerCase()}`

export async function syncSlotsFromBonushunt(client: Db, trigger: SlotSyncResult["trigger"]): Promise<SlotSyncResult> {
  const at = new Date().toISOString()
  const feeds = { changes: "not run", recent: "not run" }

  const [changes, recent] = await Promise.allSettled([readChanges(), readRecent()])
  const merged = new Map<string, FeedSlot>()
  for (const [label, outcome] of [
    ["changes", changes],
    ["recent", recent],
  ] as const) {
    if (outcome.status === "rejected") {
      feeds[label] = `failed: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`
      continue
    }
    feeds[label] = `${outcome.value.length} slots`
    for (const slot of outcome.value) {
      const existing = merged.get(keyOf(slot))
      merged.set(keyOf(slot), {
        ...slot,
        slug: slot.slug ?? existing?.slug ?? null,
        image: slot.image ?? existing?.image ?? null,
        onlyOnStake: slot.onlyOnStake || Boolean(existing?.onlyOnStake),
      })
    }
  }

  const slots = Array.from(merged.values())
  const base = { at, trigger, found: slots.length, feeds }

  if (changes.status === "rejected" && recent.status === "rejected") {
    return record(client, { ...base, ok: false, written: 0, added: 0, newSlots: [], error: "Both bonushunt.gg feeds failed." })
  }
  if (slots.length === 0) return record(client, { ...base, ok: true, written: 0, added: 0, newSlots: [] })

  // Same housekeeping as the manual import: a catalogue still holding slug-
  // style providers would otherwise get these games a second time.
  try {
    await tidyProviders(client)
  } catch (problem) {
    console.error("[slots-sync] tidy failed:", problem)
  }

  // Which of these are new, for the report. Looked up by name — a few hundred
  // names at most, in chunks to keep the URL short.
  const known = new Set<string>()
  const names = Array.from(new Set(slots.map((s) => s.name)))
  for (let i = 0; i < names.length; i += 100) {
    const { data, error } = await client.from("slots").select("game_name, provider").in("game_name", names.slice(i, i + 100))
    if (error) break
    for (const row of data ?? []) known.add(keyOf({ name: row.game_name, provider: row.provider }))
  }
  const fresh = slots.filter((s) => !known.has(keyOf(s)))

  // A row only carries the fields the feed actually had: no image means the
  // existing artwork stays, and only_on_stake is only ever set, never cleared.
  // A bulk upsert sends ONE column list for all its rows (filling gaps with
  // null), so rows are grouped by which fields they have and written per group.
  const toRow = (s: FeedSlot) => ({
    game_name: s.name,
    provider: s.provider,
    source: "stake",
    updated_at: at,
    ...(s.image ? { image_url: s.image } : {}),
    ...(s.slug ? { stake_slug: s.slug } : {}),
    ...(s.onlyOnStake ? { only_on_stake: true } : {}),
  })
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const slot of slots) {
    const row = toRow(slot)
    const signature = Object.keys(row).sort().join(",")
    groups.set(signature, [...(groups.get(signature) ?? []), row])
  }
  let written = 0
  for (const rows of groups.values()) {
    const { error } = await client.from("slots").upsert(rows, { onConflict: "game_name,provider" })
    if (error) {
      return record(client, {
        ...base,
        ok: false,
        written,
        added: 0,
        newSlots: [],
        error: `Writing to the catalogue failed: ${error.message}`,
      })
    }
    written += rows.length
  }

  return record(client, {
    ...base,
    ok: true,
    written,
    added: fresh.length,
    newSlots: fresh.slice(0, 50).map((s) => s.name),
  })
}

async function record(client: Db, result: SlotSyncResult): Promise<SlotSyncResult> {
  const { error } = await client
    .from("settings")
    .upsert({ key: SYNC_SETTINGS_KEY, value: JSON.stringify(result) }, { onConflict: "key" })
  if (error) console.error("[slots-sync] could not record the run:", error)
  console.log(`[slots-sync] ${result.trigger}: ${result.ok ? "ok" : "failed"}, ${result.found} found, ${result.added} new`, result.feeds)
  return result
}

export async function lastSlotSync(client: Db): Promise<SlotSyncResult | null> {
  const { data } = await client.from("settings").select("value").eq("key", SYNC_SETTINGS_KEY).maybeSingle()
  if (!data?.value) return null
  try {
    return JSON.parse(data.value) as SlotSyncResult
  } catch {
    return null
  }
}
