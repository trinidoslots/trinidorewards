import { discord } from "@/lib/discord/rest"
import { discordConfig } from "@/lib/discord/config"
import { CATEGORIES, ROLES, buildOverwrites } from "@/lib/discord/blueprint"
import { UserError } from "@/lib/discord/embeds"
import type { Ids } from "@/lib/discord/state"

/**
 * /setup: creates the roles and channels from the blueprint, or brings
 * existing ones back in line with it — permissions, topic and name. Matches by
 * stored id first and by name second, so a server that was built by hand is
 * adopted rather than doubled, and renaming something in the blueprint renames
 * it on the server. Mutates `ids`; the caller saves.
 */

const REASON = "TrinidoBot /setup"
const TEXT = 0
const VOICE = 2
const CATEGORY = 4

type Role = { id: string; name: string; position: number }
type Channel = { id: string; name: string; type: number }

/**
 * The names the first, German version of the bot used. A server set up by the
 * old standalone bot has no ids in discord_state, so these are what lets
 * /setup find its channels and rename them instead of building a second set.
 */
const LEGACY_NAMES: Record<string, string[]> = {
  verified: ["✅ Verifiziert"],
  pingLive: ["🔴 Live-Ping"],
  pingLeaderboard: ["🏆 Leaderboard-Ping"],
  pingRaffle: ["🎟️ Raffle-Ping"],
  pingHunt: ["🎰 Bonus-Hunt-Ping"],
  pingNews: ["📰 News-Ping"],
  welcome: ["👋│willkommen"],
  rules: ["📜│regeln"],
  verify: ["✅│verifizieren"],
  responsible: ["🛟│verantwortungsvoll-spielen"],
  news: ["📰│ankündigungen"],
  roles: ["🔔│benachrichtigungen"],
  ideas: ["💡│vorschläge"],
  help: ["❓│hilfe"],
}

const namesFor = (key: string, name: string) => [name, ...(LEGACY_NAMES[key] ?? [])]

export async function buildServer(ids: Ids): Promise<{ created: string[]; updated: string[] }> {
  const { guildId, applicationId } = discordConfig()
  const report = { created: [] as string[], updated: [] as string[] }

  const [roles, channels, me] = await Promise.all([
    discord<Role[]>("GET", `/guilds/${guildId}/roles`),
    discord<Channel[]>("GET", `/guilds/${guildId}/channels`),
    // The bot's user id is the application id.
    discord<{ roles: string[] }>("GET", `/guilds/${guildId}/members/${applicationId}`),
  ])

  const botTop = Math.max(0, ...roles.filter((r) => me.roles.includes(r.id)).map((r) => r.position))

  // 1) Roles. The bot creates them, so they start out beneath its own role.
  for (const def of ROLES) {
    const names = namesFor(def.key, def.name)
    let role =
      (ids.roles[def.key] && roles.find((r) => r.id === ids.roles[def.key])) || roles.find((r) => names.includes(r.name))
    if (!role) {
      role = await discord<Role>(
        "POST",
        `/guilds/${guildId}/roles`,
        {
          name: def.name,
          color: def.color,
          hoist: Boolean(def.hoist),
          mentionable: false, // only the bot pings these – nobody can spam them
          permissions: def.permissions ?? "0",
        },
        { reason: REASON },
      )
      report.created.push(`role ${def.name}`)
    } else if (role.position >= botTop) {
      throw new UserError(
        `The role "${role.name}" is above the bot's role. Drag the bot's role to the top under Server Settings → Roles.`,
      )
    } else if (role.name !== def.name) {
      await discord("PATCH", `/guilds/${guildId}/roles/${role.id}`, { name: def.name }, { reason: REASON })
      report.updated.push(`role ${def.name}`)
    }
    ids.roles[def.key] = role.id
  }

  const find = (storedId: string | undefined, names: string[], type: number) =>
    (storedId && channels.find((c) => c.id === storedId && c.type === type)) ||
    channels.find((c) => c.type === type && names.includes(c.name)) ||
    null

  // 2) Categories and channels
  for (const cat of CATEGORIES) {
    const catOverwrites = buildOverwrites(guildId, applicationId, ids.roles, cat.access)
    let category = find(ids.channels[`cat:${cat.key}`], namesFor(`cat:${cat.key}`, cat.name), CATEGORY)
    if (!category) {
      category = await discord<Channel>(
        "POST",
        `/guilds/${guildId}/channels`,
        { name: cat.name, type: CATEGORY, permission_overwrites: catOverwrites },
        { reason: REASON },
      )
      report.created.push(`category ${cat.name}`)
    } else {
      await discord(
        "PATCH",
        `/channels/${category.id}`,
        { name: cat.name, permission_overwrites: catOverwrites },
        { reason: REASON },
      )
      report.updated.push(`category ${cat.name}`)
    }
    ids.channels[`cat:${cat.key}`] = category.id

    for (const def of cat.channels) {
      const type = def.type === "voice" ? VOICE : TEXT
      const overwrites = buildOverwrites(guildId, applicationId, ids.roles, def.access)
      let channel = find(ids.channels[def.key], namesFor(def.key, def.name), type)
      const fields = {
        name: def.name,
        parent_id: category.id,
        permission_overwrites: overwrites,
        ...(type === TEXT && def.topic ? { topic: def.topic } : {}),
      }

      if (!channel) {
        channel = await discord<Channel>("POST", `/guilds/${guildId}/channels`, { type, ...fields }, { reason: REASON })
        report.created.push(`channel ${def.name}`)
      } else {
        await discord("PATCH", `/channels/${channel.id}`, fields, { reason: REASON })
        report.updated.push(`channel ${def.name}`)
      }
      ids.channels[def.key] = channel.id
    }
  }

  return report
}
