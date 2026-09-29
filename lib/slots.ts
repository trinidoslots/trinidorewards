import { formatProvider } from "@/lib/providers"

/**
 * The slot catalogue (the `slots` table, scripts/077) and the Stake import.
 *
 * Why the import runs in the admin's browser and not on the server: Stake
 * answers every request that is not a real browser in an allowed country with
 * a Cloudflare challenge or a country block — including Vercel's servers. The
 * same request made from a stake.com tab is just the site asking itself, so
 * the script below is pasted into the browser console there, and the file it
 * downloads is uploaded on /admin/slots.
 */

export type Slot = {
  id: number
  game_name: string
  provider: string
  image_url: string | null
  stake_slug: string | null
  source: string | null
  /** In Stake's "Only on Stake" group (scripts/078). Absent before that ran. */
  only_on_stake?: boolean | null
}

/** One entry of the uploaded file. */
export type ImportedSlot = { name: string; provider: string; slug: string | null; image: string | null }

/** The group the exclusives script reads, and the tag it becomes. */
export const ONLY_ON_STAKE_GROUP = "only-on-stake"
export const ONLY_ON_STAKE_BADGE = "Only on Stake"

/** Which kind of file was uploaded: the whole slot list, or the "Only on Stake" list. */
export function importKind(raw: unknown): "catalogue" | "only-on-stake" {
  return (raw as { group?: unknown })?.group === ONLY_ON_STAKE_GROUP ? "only-on-stake" : "catalogue"
}

export const MAX_IMPORT = 20_000

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null
  const text = value.replace(/\s+/g, " ").trim()
  return text && text.length <= max ? text : null
}

const cleanUrl = (value: unknown): string | null => {
  const text = clean(value, 600)
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Reads the downloaded file (or anything shaped like it) into rows. Accepts
 * `{ slots: [...] }` or a bare array; drops entries without a name; one row
 * per name + provider.
 */
export function parseImport(raw: unknown): { slots: ImportedSlot[]; skipped: number } {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { slots?: unknown })?.slots) ? (raw as { slots: unknown[] }).slots : null
  if (!list) throw new Error('Expected the file from the Stake script: { "slots": [ … ] }')

  const seen = new Set<string>()
  const slots: ImportedSlot[] = []
  let skipped = 0
  for (const entry of list.slice(0, MAX_IMPORT)) {
    const item = entry as Record<string, unknown>
    const name = clean(item?.name ?? item?.game_name, 200)
    if (!name) {
      skipped++
      continue
    }
    // Stake sends some providers as their slug ("donut-gaming"); stored as the name.
    const provider = formatProvider(clean(item?.provider, 100)) ?? "Unknown"
    const key = `${name.toLowerCase()}|${provider.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    slots.push({ name, provider, slug: clean(item?.slug, 200), image: cleanUrl(item?.image ?? item?.image_url) })
  }
  return { slots, skipped: skipped + Math.max(0, list.length - MAX_IMPORT) }
}

/**
 * Pasted into the browser console on stake.com. Reads every game in Stake's
 * "slots" group through the same GraphQL endpoint the site itself uses, page
 * by page, and downloads the result as stake-slots.json.
 */
export const STAKE_EXPORT_SCRIPT = `(async () => {
  const SLUG = "slots"
  const PAGE = 50
  const query = \`query SlugKuratorGroup($slug: String!, $limit: Int!, $offset: Int!) {
    slugKuratorGroup(slug: $slug) {
      gameCount
      groupGamesList(limit: $limit, offset: $offset) { game { name slug thumbnailUrl provider { name } } }
    }
  }\`
  const slots = []
  const seen = new Set()
  let total = Infinity
  for (let offset = 0; offset < total; offset += PAGE) {
    const res = await fetch("/_api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "x-language": "en" },
      body: JSON.stringify({ query, variables: { slug: SLUG, limit: PAGE, offset } }),
    })
    const json = await res.json()
    if (json.errors) { console.error("Stake answered with an error:", json.errors); break }
    const group = json.data && json.data.slugKuratorGroup
    if (!group) { console.error("No group called", SLUG); break }
    total = group.gameCount || 0
    const page = group.groupGamesList || []
    if (!page.length) break
    for (const row of page) {
      const game = row && row.game
      if (!game || seen.has(game.slug)) continue
      seen.add(game.slug)
      slots.push({ name: game.name, provider: game.provider ? game.provider.name : null, slug: game.slug, image: game.thumbnailUrl || null })
    }
    console.log("Stake slots:", slots.length, "of", total)
    await new Promise((r) => setTimeout(r, 250))
  }
  const file = new Blob([JSON.stringify({ source: "stake", exportedAt: new Date().toISOString(), slots })], { type: "application/json" })
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: "stake-slots.json" })
  document.body.appendChild(link); link.click(); link.remove()
  console.log("Done:", slots.length, "slots saved as stake-slots.json – upload it on /admin/slots")
})()`

/**
 * The same script for the "Only on Stake" group
 * (https://stake.com/casino/group/only-on-stake). Much shorter list, so it
 * runs in seconds. The file says which group it is, so the import knows to
 * set the tag rather than treat it as the whole catalogue.
 */
export const STAKE_EXCLUSIVES_SCRIPT = STAKE_EXPORT_SCRIPT.replace('const SLUG = "slots"', `const SLUG = "${ONLY_ON_STAKE_GROUP}"`)
  .replace(
    'JSON.stringify({ source: "stake", exportedAt',
    `JSON.stringify({ source: "stake", group: "${ONLY_ON_STAKE_GROUP}", exportedAt`,
  )
  .replaceAll("stake-slots.json", "stake-only-on-stake.json")
  .replace('"Stake slots:"', '"Only on Stake:"')
