import { discord } from "@/lib/discord/rest"
import { discordConfig } from "@/lib/discord/config"
import { CATEGORIES, ROLES, buildOverwrites } from "@/lib/discord/blueprint"
import { UserError } from "@/lib/discord/embeds"
import type { Ids } from "@/lib/discord/state"

/**
 * /setup: creates the roles and channels from the blueprint, or brings
 * existing ones back in line with it. Matches by stored id first and by name
 * second, so a server that was built by hand is adopted rather than doubled.
 * Mutates `ids`; the caller saves.
 */

const REASON = "TrinidoBot /setup"
const TEXT = 0
const VOICE = 2
const CATEGORY = 4

type Role = { id: string; name: string; position: number }
type Channel = { id: string; name: string; type: number }

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
    let role = (ids.roles[def.key] && roles.find((r) => r.id === ids.roles[def.key])) || roles.find((r) => r.name === def.name)
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
      report.created.push(`Rolle ${def.name}`)
    } else if (role.position >= botTop) {
      throw new UserError(
        `Die Rolle "${role.name}" steht über der Bot-Rolle. Zieh die Bot-Rolle unter Servereinstellungen → Rollen ganz nach oben.`,
      )
    }
    ids.roles[def.key] = role.id
  }

  const find = (storedId: string | undefined, name: string, type: number) =>
    (storedId && channels.find((c) => c.id === storedId && c.type === type)) ||
    channels.find((c) => c.type === type && c.name === name) ||
    null

  // 2) Categories and channels
  for (const cat of CATEGORIES) {
    const catOverwrites = buildOverwrites(guildId, applicationId, ids.roles, cat.access)
    let category = find(ids.channels[`cat:${cat.key}`], cat.name, CATEGORY)
    if (!category) {
      category = await discord<Channel>(
        "POST",
        `/guilds/${guildId}/channels`,
        { name: cat.name, type: CATEGORY, permission_overwrites: catOverwrites },
        { reason: REASON },
      )
      report.created.push(`Kategorie ${cat.name}`)
    } else {
      await discord("PATCH", `/channels/${category.id}`, { permission_overwrites: catOverwrites }, { reason: REASON })
      report.updated.push(`Kategorie ${cat.name}`)
    }
    ids.channels[`cat:${cat.key}`] = category.id

    for (const def of cat.channels) {
      const type = def.type === "voice" ? VOICE : TEXT
      const overwrites = buildOverwrites(guildId, applicationId, ids.roles, def.access)
      let channel = find(ids.channels[def.key], def.name, type)
      const fields = {
        parent_id: category.id,
        permission_overwrites: overwrites,
        ...(type === TEXT && def.topic ? { topic: def.topic } : {}),
      }

      if (!channel) {
        channel = await discord<Channel>("POST", `/guilds/${guildId}/channels`, { name: def.name, type, ...fields }, { reason: REASON })
        report.created.push(`Kanal ${def.name}`)
      } else {
        await discord("PATCH", `/channels/${channel.id}`, fields, { reason: REASON })
        report.updated.push(`Kanal ${def.name}`)
      }
      ids.channels[def.key] = channel.id
    }
  }

  return report
}
