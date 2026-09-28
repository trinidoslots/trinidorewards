import { discord } from "@/lib/discord/rest"
import { getIds, type Ids } from "@/lib/discord/state"
import * as E from "@/lib/discord/embeds"

/**
 * Posting. Everything the bot says goes through `announce`, whether it came
 * from a slash command, the Kick webhook or the site itself.
 */

export type Message = { id: string; channel_id: string }

export const messageUrl = (guildId: string, msg: Message) =>
  `https://discord.com/channels/${guildId}/${msg.channel_id}/${msg.id}`

export async function channelId(key: string, ids?: Ids): Promise<string> {
  const id = (ids ?? (await getIds())).channels[key]
  if (!id) throw new E.UserError(`Kanal "${key}" ist nicht eingerichtet – bitte zuerst /setup ausführen.`)
  return id
}

/** Posts into a channel from the blueprint and optionally pings one role. */
export async function announce(channelKey: string, pingRoleKey: string | null, payload: E.Payload): Promise<Message> {
  const ids = await getIds()
  const roleId = pingRoleKey ? ids.roles[pingRoleKey] : null
  return discord<Message>("POST", `/channels/${await channelId(channelKey, ids)}/messages`, {
    ...payload,
    content: roleId ? `<@&${roleId}>` : payload.content,
    // Only the one role this post is for may ping, whatever the text contains.
    allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] },
  })
}

export async function editMessage(channel: string, message: string, payload: E.Payload): Promise<void> {
  await discord("PATCH", `/channels/${channel}/messages/${message}`, payload)
}

/** A line in #bot-logs (and the function log). Never throws. */
export async function logToDiscord(text: string): Promise<void> {
  console.log(`[discord] ${text}`)
  try {
    const id = (await getIds()).channels.logs
    if (!id) return
    await discord("POST", `/channels/${id}/messages`, { content: text.slice(0, 1900), allowed_mentions: { parse: [] } })
  } catch {
    /* log channel unreachable – ignore */
  }
}

type Route = { channel: string; ping: string | null; build: (data: any) => E.Payload }

export const ROUTES: Record<string, Route> = {
  "leaderboard.created": { channel: "leaderboard", ping: "pingLeaderboard", build: E.leaderboardCreated },
  "leaderboard.ended": { channel: "leaderboard", ping: null, build: E.leaderboardEnded },
  "raffle.created": { channel: "raffle", ping: "pingRaffle", build: E.raffleCreated },
  "raffle.ended": { channel: "raffle", ping: null, build: E.raffleEnded },
  "bonushunt.started": { channel: "bonushunt", ping: "pingHunt", build: E.bonushuntStarted },
  "bonushunt.ended": { channel: "bonushunt", ping: null, build: E.bonushuntEnded },
  announcement: { channel: "news", ping: "pingNews", build: E.announcement },
}

const PING_FALLBACK: Record<string, string> = {
  leaderboard: "pingLeaderboard",
  raffle: "pingRaffle",
  bonushunt: "pingHunt",
  news: "pingNews",
}

export type SiteEvent = { type: string; data?: Record<string, any> }

export async function handleEvent(event: SiteEvent): Promise<Message> {
  const route = ROUTES[event?.type]
  if (!route) {
    throw new E.UserError(`Unbekannter Event-Typ: "${event?.type}". Erlaubt: ${Object.keys(ROUTES).join(", ")}`)
  }
  const data = event.data ?? {}
  // data.ping: true forces a ping, false suppresses it, otherwise the route decides.
  const ping =
    data.ping === false ? null : data.ping === true ? route.ping ?? PING_FALLBACK[route.channel] ?? null : route.ping
  return announce(route.channel, ping, route.build(data))
}
