import { getValue, setValue } from "@/lib/discord/state"

/**
 * The Kick bot's connection to Kick.
 *
 * Kick's bot messages ("type": "bot") are posted by the app's bot account
 * (@TrinidoRewards) into the channel of whoever authorised the app. So the
 * streamer connects once from the Kick bot page, and the site keeps that
 * authorisation's refresh token in discord_state (service role only) — never
 * in `settings`, which signed-in staff can read.
 *
 * The bot can be its own Kick app (KICK_BOT_CLIENT_ID / KICK_BOT_CLIENT_SECRET)
 * or the site's login app; without the first pair it falls back to the second.
 */

const STORE_KEY = "kick-bot-auth"

export const KICK_BOT_SCOPES = "user:read chat:write events:subscribe"
export const KICK_BOT_COOKIE_PATH = "/api/admin/kick-bot"
export const KICK_BOT_STATE_COOKIE = "kick_bot_state"
export const KICK_BOT_VERIFIER_COOKIE = "kick_bot_verifier"

/** The bot's own chat name, so its messages are never counted as a chatter. */
export const KICK_BOT_USERNAME = (process.env.KICK_BOT_USERNAME || "TrinidoRewards").trim().toLowerCase()

export function kickBotCredentials(): { clientId: string; clientSecret: string; ownApp: boolean } | null {
  const ownId = process.env.KICK_BOT_CLIENT_ID?.trim()
  const ownSecret = process.env.KICK_BOT_CLIENT_SECRET?.trim()
  if (ownId && ownSecret) return { clientId: ownId, clientSecret: ownSecret, ownApp: true }
  const siteId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID?.trim()
  const siteSecret = process.env.KICK_CLIENT_SECRET?.trim()
  if (siteId && siteSecret) return { clientId: siteId, clientSecret: siteSecret, ownApp: false }
  return null
}

/** Kick compares this with the app's Redirect URLs character for character. */
export function kickBotRedirectUri(origin: string) {
  return `${origin}/api/admin/kick-bot/callback`
}

type Stored = {
  refreshToken: string
  accessToken: string
  expiresAt: number
  scope: string
  userId: number | null
  username: string | null
  connectedAt: string
}

export type BotConnection = {
  connected: boolean
  username: string | null
  userId: number | null
  scope: string | null
  connectedAt: string | null
}

async function readStored(): Promise<Stored | null> {
  const stored = await getValue<Stored | null>(STORE_KEY)
  return stored?.refreshToken ? stored : null
}

export async function botConnection(): Promise<BotConnection> {
  const stored = await readStored()
  return {
    connected: Boolean(stored),
    username: stored?.username ?? null,
    userId: stored?.userId ?? null,
    scope: stored?.scope ?? null,
    connectedAt: stored?.connectedAt ?? null,
  }
}

export async function disconnectBot() {
  await setValue(STORE_KEY, null)
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }

async function tokenRequest(body: Record<string, string>): Promise<Required<Pick<TokenResponse, "access_token" | "refresh_token">> & TokenResponse> {
  const credentials = kickBotCredentials()
  if (!credentials) throw new Error("No Kick app is configured (KICK_BOT_CLIENT_ID / KICK_BOT_CLIENT_SECRET).")
  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, ...body }),
    cache: "no-store",
  })
  const json = (await res.json().catch(() => null)) as (TokenResponse & { error?: string; message?: string }) | null
  if (!res.ok || !json?.access_token || !json.refresh_token) {
    throw new Error(`Kick token request failed (HTTP ${res.status}${json?.error || json?.message ? ` – ${json.error ?? json.message}` : ""})`)
  }
  return json as Required<Pick<TokenResponse, "access_token" | "refresh_token">> & TokenResponse
}

function expiry(expiresIn: number | undefined) {
  return Date.now() + (Number(expiresIn) || 3600) * 1000
}

/** The callback's half: trade the code, learn whose channel this is, store it. */
export async function exchangeBotCode(code: string, redirectUri: string, verifier: string): Promise<BotConnection> {
  const token = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier })

  const me = await fetch("https://api.kick.com/public/v1/users", {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    cache: "no-store",
  })
    .then((res) => res.json())
    .then((json) => json?.data?.[0] ?? null)
    .catch(() => null)

  const stored: Stored = {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expiresAt: expiry(token.expires_in),
    scope: token.scope ?? KICK_BOT_SCOPES,
    userId: typeof me?.user_id === "number" ? me.user_id : null,
    username: typeof me?.name === "string" ? me.name : null,
    connectedAt: new Date().toISOString(),
  }
  await setValue(STORE_KEY, stored)
  return botConnection()
}

/** A working access token, refreshed when it is close to expiring. Null when not connected. */
async function accessToken(force = false): Promise<string | null> {
  const stored = await readStored()
  if (!stored) return null
  if (!force && stored.accessToken && Date.now() < stored.expiresAt - 60_000) return stored.accessToken

  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: stored.refreshToken })
  await setValue(STORE_KEY, {
    ...stored,
    accessToken: token.access_token,
    // Kick may hand back a new refresh token; the old one stops working then.
    refreshToken: token.refresh_token || stored.refreshToken,
    expiresAt: expiry(token.expires_in),
    scope: token.scope ?? stored.scope,
  } satisfies Stored)
  return token.access_token
}

/** A call to Kick's public API as the connected channel. Retries once on a 401 with a fresh token. */
export async function kickAsBot<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  for (const force of [false, true]) {
    const token = await accessToken(force)
    if (!token) throw new Error("The Kick bot is not connected.")
    const res = await fetch(`https://api.kick.com/public/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    })
    if (res.status === 401 && !force) continue
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(`Kick API ${path}: HTTP ${res.status}${json?.message ? ` – ${json.message}` : ""}`)
    return json as T
  }
  throw new Error("Kick refused the bot's token. Connect the bot again.")
}

/** Kick's limit is 500 characters; a longer announcement is cut rather than refused. */
function fitMessage(content: string) {
  const chars = Array.from(content.replace(/\s+/g, " ").trim())
  return chars.length <= 500 ? chars.join("") : `${chars.slice(0, 497).join("")}...`
}

/** Posts in the channel as the bot. Throws when Kick refuses. */
export async function sendBotMessage(content: string, replyTo?: string | null): Promise<string | null> {
  const text = fitMessage(content)
  if (!text) throw new Error("Empty message.")
  const json = await kickAsBot<{ data?: { is_sent?: boolean; message_id?: string } }>("POST", "/chat", {
    type: "bot",
    content: text,
    ...(replyTo ? { reply_to_message_id: replyTo } : {}),
  })
  if (json?.data?.is_sent === false) throw new Error("Kick did not send the message.")
  return json?.data?.message_id ?? null
}

export const CHAT_EVENT = { name: "chat.message.sent", version: 1 }

export async function chatSubscriptions(): Promise<{ id: string; event: string }[]> {
  const json = await kickAsBot<{ data?: { id: string; event: string }[] }>("GET", "/events/subscriptions")
  return (json?.data ?? []).filter((sub) => sub.event === CHAT_EVENT.name)
}

/**
 * Has Kick send the channel's chat to the webhook. With a user token Kick
 * takes the channel from the token, so this is always the connected channel.
 * Kick delivers to the Webhook URL set on the app this token belongs to.
 */
export async function subscribeChat(): Promise<string> {
  if ((await chatSubscriptions()).length > 0) return "Chat is already subscribed."
  await kickAsBot("POST", "/events/subscriptions", { events: [CHAT_EVENT], method: "webhook" })
  return "Subscribed to chat messages."
}
