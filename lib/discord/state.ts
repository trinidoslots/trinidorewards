import { serviceClient } from "@/lib/supabase/service"

/**
 * The bot's memory: which roles, channels and panel messages it made, and
 * whether the stream is live. The old bot kept this in data/state.json; a
 * serverless function has no disk that survives, so it lives in discord_state
 * (scripts/074). Only the service role can read or write that table.
 */

export type Ids = {
  roles: Record<string, string>
  channels: Record<string, string>
  panels: Record<string, string>
}

export type LiveState = {
  isLive: boolean
  channelId: string | null
  messageId: string | null
  startedAt: string | null
  endedAt: string | null
  title: string | null
  category: string | null
}

const emptyIds = (): Ids => ({ roles: {}, channels: {}, panels: {} })
const emptyLive = (): LiveState => ({
  isLive: false,
  channelId: null,
  messageId: null,
  startedAt: null,
  endedAt: null,
  title: null,
  category: null,
})

async function read<T>(key: string): Promise<T | null> {
  const { data, error } = await serviceClient().from("discord_state").select("value").eq("key", key).maybeSingle()
  if (error) throw new Error(`discord_state lesen fehlgeschlagen (${error.message}) – ist scripts/074 gelaufen?`)
  return (data?.value as T) ?? null
}

async function write(key: string, value: unknown): Promise<void> {
  const { error } = await serviceClient()
    .from("discord_state")
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw new Error(`discord_state schreiben fehlgeschlagen (${error.message})`)
}

export async function getIds(): Promise<Ids> {
  const stored = await read<Partial<Ids>>("ids")
  return { ...emptyIds(), ...(stored ?? {}) }
}
export const saveIds = (ids: Ids) => write("ids", ids)

export async function getLive(): Promise<LiveState> {
  return { ...emptyLive(), ...((await read<Partial<LiveState>>("live")) ?? {}) }
}
export const saveLive = (live: LiveState) => write("live", live)

export async function getValue<T>(key: string): Promise<T | null> {
  return read<T>(key)
}
export const setValue = (key: string, value: unknown) => write(key, value)

/**
 * Claims a one-off action. Returns true for exactly one caller however many
 * race for it: the insert collides on the primary key for everyone else.
 *
 * This is what stops a raffle being announced twice when the admin saves the
 * form twice, or the nightly cron and the admin button finalise the same
 * leaderboard at once.
 */
export async function claimOnce(key: string): Promise<boolean> {
  const { error } = await serviceClient()
    .from("discord_state")
    .insert({ key: `once:${key}`, value: { at: new Date().toISOString() } })
  if (!error) return true
  if (error.code === "23505") return false
  throw new Error(`discord_state: ${error.message}`)
}

/** Gives a claim back, for when the thing it guarded failed and should be retried. */
export async function releaseOnce(key: string): Promise<void> {
  await serviceClient().from("discord_state").delete().eq("key", `once:${key}`)
}
