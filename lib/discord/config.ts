/**
 * Everything the Discord bot reads from the environment, in one place.
 *
 * Read lazily rather than at import time: most of the site never touches the
 * bot, and a missing Discord variable must not break a page that has nothing
 * to do with it. Callers that do need the bot go through `discordConfig()`,
 * which throws with the name of whatever is missing.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://trinidorewards.com").replace(/\/$/, "")
export const KICK_SLUG = process.env.KICK_SLUG || "trinidoslots"
export const kickUrl = () => `https://kick.com/${KICK_SLUG}`

export type DiscordConfig = {
  token: string
  applicationId: string
  publicKey: string
  guildId: string
}

export function discordConfig(): DiscordConfig {
  const values = {
    token: process.env.DISCORD_BOT_TOKEN,
    applicationId: process.env.DISCORD_APPLICATION_ID,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    guildId: process.env.DISCORD_GUILD_ID,
  }
  const names: Record<keyof DiscordConfig, string> = {
    token: "DISCORD_BOT_TOKEN",
    applicationId: "DISCORD_APPLICATION_ID",
    publicKey: "DISCORD_PUBLIC_KEY",
    guildId: "DISCORD_GUILD_ID",
  }
  const missing = (Object.keys(values) as (keyof DiscordConfig)[]).filter((key) => !values[key])
  if (missing.length) {
    throw new Error(`Discord is not configured: missing ${missing.map((key) => names[key]).join(", ")}`)
  }
  return values as DiscordConfig
}

/** True when the bot can post. Site hooks check this and quietly skip otherwise. */
export function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID)
}
