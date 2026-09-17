// Shared vocabulary for reading Kick chat. The admin giveaway page and the OBS
// stream widget both subscribe to the same Pusher app Kick's own web client uses,
// so the payload shapes and emote syntax live here rather than being restated.

export const KICK_PUSHER_URL =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false"

export const KICK_GREEN = "#53fc18"

/** Fallback for senders Kick didn't assign an identity colour. */
export const KICK_DEFAULT_USER_COLOR = "#FFFFFF"

export const MOD_TYPES = new Set(["moderator", "broadcaster"])

// Kick sends emotes inline in message content as raw placeholder codes, e.g.
// "[emote:553704:trainwreckstvNodders]" — never as the rendered image. Both the
// id (for the image URL) and the name (for the alt text / keyword display) matter.
export const EMOTE_CODE_REGEX = /\[(?:emote|emoji):(\d+):([^\]]+)\]/g
export const EMOTE_CODE_SINGLE = /^\[(?:emote|emoji):\d+:([^\]]+)\]$/

export function emoteImageUrl(id: string) {
  return `https://files.kick.com/emotes/${id}/fullsize`
}

export function emoteFriendlyName(code: string) {
  return code.match(EMOTE_CODE_SINGLE)?.[1] ?? code
}

export function formatKeywordForDisplay(keyword: string | null | undefined) {
  const trimmed = keyword?.trim()
  return trimmed ? emoteFriendlyName(trimmed) : ""
}

export type KickBadge = {
  type: string
  text?: string
  /** Subscriber badges carry the month count Kick renders inside the pill. */
  count?: number
}

export type KickChatPayload = {
  id?: string
  content?: string
  created_at?: string
  sender?: {
    id?: number
    username?: string
    slug?: string
    identity?: { color?: string; badges?: KickBadge[] }
  }
}

export type KickMessage = {
  id: string
  username: string
  content: string
  color: string
  badges: KickBadge[]
  isMod: boolean
  receivedAt: number
}

export function isModOrBroadcaster(badges: KickBadge[] | undefined) {
  return (badges ?? []).some((badge) => MOD_TYPES.has(badge.type))
}

/** Content split into plain runs and emote references, ready to render. */
export type ContentPart = { kind: "text"; text: string } | { kind: "emote"; id: string; name: string }

export function parseMessageContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const regex = new RegExp(EMOTE_CODE_REGEX)
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", text: content.slice(lastIndex, match.index) })
    }
    parts.push({ kind: "emote", id: match[1], name: match[2] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ kind: "text", text: content.slice(lastIndex) })
  }

  return parts
}

/** MM:SS, widening to H:MM:SS only once an hour has actually elapsed. */
export function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
