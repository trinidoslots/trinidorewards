import { KICK_SLUG, SITE_URL, kickUrl } from "@/lib/discord/config"
import { discordTime, formatDuration } from "@/lib/discord/time"

/**
 * What every post looks like. Plain Discord API JSON — the shapes discord.js's
 * builders would have produced.
 */

export const COLORS = {
  kick: 0x53fc18,
  gold: 0xf5b82e,
  raffle: 0xa855f7,
  hunt: 0xef4444,
  news: 0x3b82f6,
  ended: 0x4b5563,
}

export const FOOTER = { text: "TrinidoRewards · 18+ · Play responsibly" }

/** A mistake by whoever asked (bad input), as opposed to something breaking. Shown to them as-is. */
export class UserError extends Error {}

export type Embed = Record<string, any>
export type Payload = { content?: string; embeds?: Embed[]; components?: any[]; allowed_mentions?: any; flags?: number }

const clip = (s: unknown, n: number): string | undefined => {
  if (s === undefined || s === null || s === "") return undefined
  const text = String(s)
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

function safeUrl(url: unknown, fallback: string | null): string | null {
  if (!url) return fallback
  try {
    const u = new URL(String(url), SITE_URL)
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : fallback
  } catch {
    return fallback
  }
}

function requireTitle(data: any): string {
  if (!data?.title || !String(data.title).trim()) throw new UserError('The "title" field is missing.')
  return clip(String(data.title).trim(), 200)!
}

export type Link = { label: string; url: string | null | undefined; emoji?: string }

export function linkRow(links: Link[]) {
  return {
    type: 1,
    components: links
      .filter((l) => l?.url)
      .slice(0, 5)
      .map((l) => ({ type: 2, style: 5, label: l.label, url: l.url, ...(l.emoji ? { emoji: { name: l.emoji } } : {}) })),
  }
}

function field(name: string, value: unknown, inline = true) {
  return value ? { name, value: clip(value, 1024), inline } : null
}

function base(color: number, title: string, url: string | null, description?: unknown): Embed {
  return {
    color,
    title: clip(title, 256),
    ...(url ? { url } : {}),
    ...(description ? { description: clip(description, 4000) } : {}),
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  }
}

function withImage(embed: Embed, imageUrl: unknown): Embed {
  const img = safeUrl(imageUrl, null)
  if (img) embed.image = { url: img }
  return embed
}

function withFields(embed: Embed, fields: (ReturnType<typeof field>)[]): Embed {
  const present = fields.filter(Boolean)
  if (present.length) embed.fields = present
  return embed
}

export type Winner = { name?: string; prize?: string; rank?: number }

function winnersText(winners: Winner[] | undefined): string | null {
  if (!Array.isArray(winners) || winners.length === 0) return null
  const medals = ["🥇", "🥈", "🥉"]
  return winners
    .slice(0, 25)
    .map((w, i) => {
      const rank = w.rank ?? i + 1
      const icon = medals[rank - 1] ?? `**${rank}.**`
      return `${icon} ${w.name ?? "Unknown"}${w.prize ? ` — ${w.prize}` : ""}`
    })
    .join("\n")
}

// ─── Kick live ───────────────────────────────────────────────

export type StreamInfo = { title?: string | null; category?: string | null; viewers?: number | null; thumbnail?: string | null }

export function liveMessage(stream: StreamInfo, startedAt: string | null): Payload {
  const url = kickUrl()
  const embed: Embed = {
    color: COLORS.kick,
    author: { name: `${KICK_SLUG} is LIVE on Kick`, url },
    title: clip(stream.title || "The stream is on!", 256),
    url,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  }
  withFields(embed, [
    field("Category", stream.category),
    field("Viewers", typeof stream.viewers === "number" ? String(stream.viewers) : null),
    field("Live since", discordTime(startedAt, "R")),
  ])
  if (stream.thumbnail?.startsWith("http")) {
    embed.image = { url: `${stream.thumbnail}${stream.thumbnail.includes("?") ? "&" : "?"}t=${Date.now()}` }
  }
  return {
    embeds: [embed],
    components: [
      linkRow([
        { label: "Watch now", url, emoji: "🔴" },
        { label: "TrinidoRewards", url: SITE_URL, emoji: "🎁" },
      ]),
    ],
  }
}

export function liveEndedMessage(stream: StreamInfo, startedAt: string | null, endedAt: string | null): Payload {
  const end = endedAt ? new Date(endedAt) : new Date()
  const embed = base(COLORS.ended, stream.title || "Stream ended", kickUrl(), [
    `Stream ended ${discordTime(end, "R")}.`,
    startedAt ? `Duration: **${formatDuration(end.getTime() - new Date(startedAt).getTime())}**` : null,
    "Thanks for watching! 💚",
  ]
    .filter(Boolean)
    .join("\n"))
  embed.author = { name: `${KICK_SLUG} was live`, url: kickUrl() }
  return {
    embeds: [embed],
    components: [
      linkRow([
        { label: "Kick channel", url: kickUrl(), emoji: "📺" },
        { label: "Leaderboard", url: `${SITE_URL}/leaderboard`, emoji: "🏆" },
      ]),
    ],
  }
}

// ─── Site events ─────────────────────────────────────────────

export function leaderboardCreated(d: any): Payload {
  const title = requireTitle(d)
  const url = safeUrl(d.url, `${SITE_URL}/leaderboard`)
  const embed = base(COLORS.gold, `🏆 New leaderboard: ${title}`, url, d.description)
  withFields(embed, [
    field("Prize pool", d.prizePool),
    field("Start", discordTime(d.startsAt)),
    field("Ends", discordTime(d.endsAt) && `${discordTime(d.endsAt)}\n(${discordTime(d.endsAt, "R")})`),
  ])
  withImage(embed, d.imageUrl)
  return { embeds: [embed], components: [linkRow([{ label: "View leaderboard", url, emoji: "🏆" }])] }
}

export function leaderboardEnded(d: any): Payload {
  const title = requireTitle(d)
  const url = safeUrl(d.url, `${SITE_URL}/leaderboard`)
  const embed = base(COLORS.gold, `🏁 Leaderboard ended: ${title}`, url, d.description)
  const w = winnersText(d.winners)
  if (w) embed.fields = [{ name: "Winners", value: clip(w, 1024) }]
  withImage(embed, d.imageUrl)
  return { embeds: [embed], components: [linkRow([{ label: "View results", url, emoji: "📊" }])] }
}

export function raffleCreated(d: any): Payload {
  const title = requireTitle(d)
  const url = safeUrl(d.url, `${SITE_URL}/raffles`)
  const embed = base(COLORS.raffle, `🎟️ New raffle: ${title}`, url, d.description)
  withFields(embed, [
    field("Prize", d.prize),
    field("Ends", discordTime(d.endsAt) && `${discordTime(d.endsAt)}\n(${discordTime(d.endsAt, "R")})`),
    field("How to enter", d.howToEnter, false),
  ])
  withImage(embed, d.imageUrl)
  return { embeds: [embed], components: [linkRow([{ label: "Enter now", url, emoji: "🎟️" }])] }
}

export function raffleEnded(d: any): Payload {
  const title = requireTitle(d)
  const url = safeUrl(d.url, `${SITE_URL}/raffles`)
  const embed = base(COLORS.raffle, `🎉 Raffle winner: ${title}`, url, d.description)
  const w = winnersText(d.winners)
  if (w) embed.fields = [{ name: "Winners", value: clip(w, 1024) }]
  return { embeds: [embed], components: [linkRow([{ label: "TrinidoRewards", url, emoji: "🎁" }])] }
}

export function bonushuntStarted(d: any): Payload {
  const title = requireTitle(d)
  const url = safeUrl(d.url, `${SITE_URL}/bonushunt`)
  const embed = base(COLORS.hunt, `🎰 Bonus hunt started: ${title}`, url, d.description ?? "Guess the final balance on the site now!")
  withFields(embed, [field("Start balance", d.startBalance), field("Bonuses", d.bonusCount)])
  withImage(embed, d.imageUrl)
  return { embeds: [embed], components: [linkRow([{ label: "Guess the balance", url, emoji: "🎯" }])] }
}

export function bonushuntEnded(d: any): Payload {
  const title = requireTitle(d)
  const url = safeUrl(d.url, `${SITE_URL}/bonushunt`)
  const embed = base(COLORS.hunt, `🏁 Bonus hunt ended: ${title}`, url, d.description)
  withFields(embed, [
    field("Start balance", d.startBalance),
    field("Final balance", d.result),
    field("Best bonus", d.bestWin),
    field("Winner (guess)", d.winner),
  ])
  return { embeds: [embed], components: [linkRow([{ label: "View result", url, emoji: "📊" }])] }
}

export function announcement(d: any): Payload {
  const title = requireTitle(d)
  const url = safeUrl(d.url, null)
  const embed = base(COLORS.news, `📰 ${title}`, url, d.text ?? d.description)
  withImage(embed, d.imageUrl)
  return { embeds: [embed], components: url ? [linkRow([{ label: "Learn more", url, emoji: "🔗" }])] : [] }
}
