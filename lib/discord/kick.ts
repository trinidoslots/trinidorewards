import crypto from "node:crypto"
import { KICK_SLUG } from "@/lib/discord/config"
import { announce, editMessage, logToDiscord } from "@/lib/discord/announce"
import { liveEndedMessage, liveMessage, type StreamInfo } from "@/lib/discord/embeds"
import { claimOnce, getIds, getLive, saveLive } from "@/lib/discord/state"

/**
 * Kick → Discord live announcements.
 *
 * The old bot polled Kick every minute. Nothing here runs between requests,
 * and the hosting plan allows one cron a day, so instead Kick calls us:
 * `livestream.status.updated` when the stream starts or stops,
 * `livestream.metadata.updated` when the title or category changes. The
 * subscription is made once from /admin/discord with the site's own Kick app.
 */

const RECONNECT_GRACE_MS = 10 * 60 * 1000 // back within 10 minutes = same stream, no second ping

// ─── Kick API ────────────────────────────────────────────────

let cachedToken: { value: string; expires: number } | null = null

async function appToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires - 60_000) return cachedToken.value
  const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID
  const clientSecret = process.env.KICK_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("NEXT_PUBLIC_KICK_CLIENT_ID / KICK_CLIENT_SECRET are missing.")

  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Kick token request failed (HTTP ${res.status}) – check the client ID/secret.`)
  const json = await res.json()
  cachedToken = { value: json.access_token, expires: Date.now() + (Number(json.expires_in) || 3600) * 1000 }
  return cachedToken.value
}

async function kick<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.kick.com/public/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await appToken()}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  if (res.status === 401) cachedToken = null
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`Kick API ${path}: HTTP ${res.status}${json?.message ? ` – ${json.message}` : ""}`)
  return json as T
}

export type KickChannel = {
  broadcaster_user_id: number
  slug: string
  stream_title?: string
  category?: { name?: string }
  stream?: { is_live?: boolean; viewer_count?: number; thumbnail?: string | { url?: string }; start_time?: string }
}

export async function fetchKickChannel(slug = KICK_SLUG): Promise<KickChannel | null> {
  const json = await kick<{ data?: KickChannel[] }>("GET", `/channels?slug=${encodeURIComponent(slug)}`)
  return json?.data?.[0] ?? null
}

export function streamInfo(channel: KickChannel | null, fallbackTitle?: string | null): StreamInfo {
  const thumb = channel?.stream?.thumbnail
  return {
    title: channel?.stream_title || fallbackTitle || null,
    category: channel?.category?.name ?? null,
    viewers: typeof channel?.stream?.viewer_count === "number" ? channel.stream.viewer_count : null,
    thumbnail: typeof thumb === "string" ? thumb : thumb?.url ?? null,
  }
}

const EVENTS = [
  { name: "livestream.status.updated", version: 1 },
  { name: "livestream.metadata.updated", version: 1 },
]

export async function listSubscriptions(): Promise<{ id: string; event: string; broadcaster_user_id: number }[]> {
  const json = await kick<{ data?: any[] }>("GET", "/events/subscriptions")
  return json?.data ?? []
}

/** Subscribes the site's Kick app to the channel's live events. Safe to repeat. */
export async function subscribeLiveEvents(): Promise<string> {
  const channel = await fetchKickChannel()
  if (!channel) throw new Error(`Kick channel "${KICK_SLUG}" not found.`)
  const existing = await listSubscriptions()
  const missing = EVENTS.filter(
    (e) => !existing.some((s) => s.event === e.name && Number(s.broadcaster_user_id) === Number(channel.broadcaster_user_id)),
  )
  if (missing.length === 0) return "Already subscribed."
  await kick("POST", "/events/subscriptions", {
    broadcaster_user_id: channel.broadcaster_user_id,
    events: missing,
    method: "webhook",
  })
  return `Subscribed: ${missing.map((e) => e.name).join(", ")}`
}

// ─── Webhook signature ───────────────────────────────────────

// Published by Kick at https://docs.kick.com/events/webhook-security and served
// from /public/v1/public-key. Fetched at runtime so a rotation is picked up;
// this copy is only the fallback if that fetch fails.
const KICK_PUBLIC_KEY_FALLBACK = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`

let publicKey: string | null = null

async function kickPublicKey(): Promise<string> {
  if (publicKey) return publicKey
  try {
    const res = await fetch("https://api.kick.com/public/v1/public-key", { cache: "no-store" })
    const json = await res.json()
    if (typeof json?.data?.public_key === "string") publicKey = json.data.public_key
  } catch {
    /* fall through to the published copy */
  }
  return publicKey ?? KICK_PUBLIC_KEY_FALLBACK
}

export async function verifyKickRequest(headers: Headers, rawBody: string): Promise<boolean> {
  const id = headers.get("kick-event-message-id")
  const timestamp = headers.get("kick-event-message-timestamp")
  const signature = headers.get("kick-event-signature")
  if (!id || !timestamp || !signature) return false
  const payload = `${id}.${timestamp}.${rawBody}`
  try {
    return crypto.verify("sha256", Buffer.from(payload), await kickPublicKey(), Buffer.from(signature, "base64"))
  } catch {
    return false
  }
}

// ─── Live state machine ──────────────────────────────────────

type StatusEvent = { is_live: boolean; title?: string; started_at?: string | null; ended_at?: string | null }
type MetadataEvent = { metadata?: { title?: string; category?: { name?: string } } }

async function currentStream(fallbackTitle?: string | null): Promise<StreamInfo> {
  // The webhook carries the title but not the viewer count or thumbnail. Asked
  // for, not relied on: if Kick's API is slow the post goes out without them.
  const channel = await fetchKickChannel().catch(() => null)
  return streamInfo(channel, fallbackTitle)
}

export async function handleStatus(event: StatusEvent): Promise<void> {
  const ids = await getIds()
  if (!ids.channels.live) return // server not set up yet
  const live = await getLive()

  if (event.is_live) {
    if (live.isLive) return
    // Kick retries deliveries. The stream's start time is the same on every
    // retry, so it names this go-live exactly once.
    if (!(await claimOnce(`live-start:${event.started_at ?? "unknown"}`))) return

    const stream = await currentStream(event.title)
    const recentlyEnded = live.endedAt && Date.now() - new Date(live.endedAt).getTime() < RECONNECT_GRACE_MS

    if (recentlyEnded && live.channelId && live.messageId) {
      // A short drop (internet, OBS restart): bring the old post back, ping nobody.
      try {
        await editMessage(live.channelId, live.messageId, liveMessage(stream, live.startedAt))
        await saveLive({ ...live, isLive: true, endedAt: null, title: stream.title ?? live.title, category: stream.category ?? live.category })
        await logToDiscord("🔁 Stream back live after a short drop – no second ping.")
        return
      } catch {
        /* the old post is gone – announce afresh below */
      }
    }

    const startedAt = event.started_at ? new Date(event.started_at).toISOString() : new Date().toISOString()
    const msg = await announce("live", "pingLive", liveMessage(stream, startedAt))
    await saveLive({
      isLive: true,
      channelId: msg.channel_id,
      messageId: msg.id,
      startedAt,
      endedAt: null,
      title: stream.title ?? null,
      category: stream.category ?? null,
    })
    await logToDiscord(`🔴 Went live: "${stream.title ?? ""}" – announcement posted.`)
    return
  }

  if (!live.isLive) return
  const endedAt = event.ended_at ? new Date(event.ended_at).toISOString() : new Date().toISOString()
  if (live.channelId && live.messageId) {
    await editMessage(
      live.channelId,
      live.messageId,
      liveEndedMessage({ title: event.title ?? live.title, category: live.category }, live.startedAt, endedAt),
    ).catch(() => {})
  }
  await saveLive({ ...live, isLive: false, endedAt })
  await logToDiscord("⚫ Stream ended – live post updated.")
}

export async function handleMetadata(event: MetadataEvent): Promise<void> {
  const live = await getLive()
  if (!live.isLive || !live.channelId || !live.messageId) return
  const title = event.metadata?.title ?? live.title
  const category = event.metadata?.category?.name ?? live.category
  const stream = await currentStream(title)
  await editMessage(live.channelId, live.messageId, liveMessage({ ...stream, title, category }, live.startedAt)).catch(() => {})
  await saveLive({ ...live, title: title ?? null, category: category ?? null })
}
