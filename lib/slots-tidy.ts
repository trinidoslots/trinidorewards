import { formatProvider } from "@/lib/providers"

/**
 * Rewrites slug-style provider names in the catalogue ("donut-gaming") as
 * names ("Donut Gaming"), with the same rule imports use (lib/providers).
 *
 * Server-only (takes the service-role client). Run by the button on
 * /admin/slots and at the start of every import: an import writes clean names
 * and upserts on (game_name, provider), so a catalogue still holding the slug
 * would otherwise get the same game a second time.
 *
 * One update per provider, a few hundred at most. The rename can collide with
 * a row that already has the proper name — typically one typed in by hand. Then
 * the two are merged: the named row stays and takes over the artwork, Stake id
 * and Only on Stake tag the slug row had, and the slug row goes.
 */

type Db = { from: (table: string) => any }

type Row = {
  id: number
  game_name: string
  provider: string
  image_url?: string | null
  stake_slug?: string | null
  only_on_stake?: boolean | null
}

const PAGE = 1000

export async function tidyProviders(client: Db): Promise<{ providers: number; renamed: number; merged: number }> {
  // Every distinct provider, paged: PostgREST returns at most 1000 rows a request.
  const providers = new Set<string>()
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await client.from("slots").select("provider").order("id").range(from, from + PAGE - 1)
    if (error) throw new Error(`Could not read the catalogue: ${error.message}`)
    for (const row of data ?? []) if (row.provider) providers.add(String(row.provider))
    if (!data || data.length < PAGE) break
  }

  const renames = Array.from(providers)
    .map((from) => ({ from, to: formatProvider(from) ?? from }))
    .filter((rename) => rename.to !== rename.from)

  let renamed = 0
  let merged = 0
  const now = new Date().toISOString()

  for (const { from, to } of renames) {
    const { data, error } = await client
      .from("slots")
      .update({ provider: to, updated_at: now })
      .eq("provider", from)
      .select("id")
    if (!error) {
      renamed += (data ?? []).length
      continue
    }
    if (error.code !== "23505") {
      console.error("[slots] tidy failed for", from, error)
      continue
    }

    // Some games already exist under the proper name: one row at a time.
    const { data: rows } = await client.from("slots").select("*").eq("provider", from)
    for (const row of (rows ?? []) as Row[]) {
      const { data: existing } = await client
        .from("slots")
        .select("*")
        .eq("game_name", row.game_name)
        .eq("provider", to)
        .maybeSingle()
      if (!existing) {
        const { error: single } = await client.from("slots").update({ provider: to, updated_at: now }).eq("id", row.id)
        if (!single) renamed++
        continue
      }
      const keep = existing as Row
      await client
        .from("slots")
        .update({
          image_url: keep.image_url ?? row.image_url ?? null,
          stake_slug: keep.stake_slug ?? row.stake_slug ?? null,
          ...(row.only_on_stake ? { only_on_stake: true } : {}),
          updated_at: now,
        })
        .eq("id", keep.id)
      await client.from("slots").delete().eq("id", row.id)
      merged++
    }
  }

  return { providers: renames.length, renamed, merged }
}
