import { discord } from "@/lib/discord/rest"
import { discordConfig, KICK_SLUG, SITE_URL, kickUrl } from "@/lib/discord/config"
import { channelId, handleEvent, logToDiscord, messageUrl, type SiteEvent } from "@/lib/discord/announce"
import { COLORS, FOOTER, linkRow, liveMessage, UserError, type Payload } from "@/lib/discord/embeds"
import { fetchKickChannel, listSubscriptions, streamInfo } from "@/lib/discord/kick"
import { postPanels } from "@/lib/discord/panels"
import { buildServer } from "@/lib/discord/setup"
import { getIds, getLive, saveIds } from "@/lib/discord/state"
import { currentStandings } from "@/lib/discord/site"
import { discordTime } from "@/lib/discord/time"
import { PING_ROLES } from "@/lib/discord/blueprint"

/**
 * Slash commands and buttons.
 *
 * Discord waits three seconds for an answer. Anything slower answers
 * "thinking…" first (a deferred response) and edits that reply when done; the
 * route runs the slow part after responding.
 */

const SUB = 1
const STRING = 3
const BOOLEAN = 5
const ADMIN = "8" // Administrator
const MODS = "8192" // Manage Messages
export const EPHEMERAL = 64

const str = (name: string, description: string, required = false) => ({ type: STRING, name, description, required })

// Dates are typed as Berlin time; Discord then shows them in each reader's own zone.
const DATE_HINT = "DD.MM.YYYY HH:MM (Berlin time)"

/**
 * Registering replaces the whole set, so a command that is renamed here (the
 * German /ankuendigen became /announce) disappears from Discord the next time
 * "Register slash commands" is clicked.
 */
export const COMMANDS = [
  {
    name: "setup",
    description: "Creates or updates the TrinidoRewards server's roles, channels and panels",
    default_member_permissions: ADMIN,
  },
  {
    name: "announce",
    description: "Post an announcement by hand (when the site doesn't send one automatically)",
    default_member_permissions: MODS,
    options: [
      {
        type: SUB,
        name: "leaderboard",
        description: "Announce a new leaderboard",
        options: [
          str("title", "e.g. October Leaderboard", true),
          str("prizepool", "e.g. $1,000"),
          str("start", DATE_HINT),
          str("end", DATE_HINT),
          str("description", "Extra text"),
          str("link", "Default: /leaderboard"),
          str("image", "Image URL (optional)"),
        ],
      },
      {
        type: SUB,
        name: "raffle",
        description: "Announce a new raffle",
        options: [
          str("title", "e.g. $100 Weekend Raffle", true),
          str("prize", "What can be won?"),
          str("end", DATE_HINT),
          str("howtoenter", "How do people enter?"),
          str("description", "Extra text"),
          str("link", "Link to the raffle"),
          str("image", "Image URL (optional)"),
        ],
      },
      {
        type: SUB,
        name: "bonushunt",
        description: "Announce a bonus hunt starting",
        options: [
          str("title", "e.g. Bonus Hunt #42", true),
          str("startbalance", "e.g. $2,500"),
          str("bonuses", "Number of bonuses"),
          str("description", "Extra text"),
          str("link", "Default: /bonushunt"),
        ],
      },
      {
        type: SUB,
        name: "winners",
        description: "Post the winners of a raffle or leaderboard",
        options: [
          {
            type: STRING,
            name: "type",
            description: "For what?",
            required: true,
            choices: [
              { name: "Raffle", value: "raffle" },
              { name: "Leaderboard", value: "leaderboard" },
            ],
          },
          str("title", "Name of the raffle/leaderboard", true),
          str("winners", "Format: Name – Prize; Name2 – Prize2", true),
          str("link", "Link (optional)"),
        ],
      },
      {
        type: SUB,
        name: "news",
        description: "General announcement",
        options: [
          str("title", "Headline", true),
          str("text", "Content", true),
          str("link", "Link (optional)"),
          str("image", "Image URL (optional)"),
          { type: BOOLEAN, name: "ping", description: "Ping the News role? (default: yes)" },
        ],
      },
    ],
  },
  {
    name: "live",
    description: "Check the Kick live notifications",
    default_member_permissions: MODS,
    options: [
      { type: SUB, name: "status", description: "Shows what the bot currently knows about the Kick channel" },
      { type: SUB, name: "test", description: "Posts a preview of the live post in #bot-logs (no ping)" },
    ],
  },
  { name: "links", description: "All the important TrinidoRewards links" },
  { name: "leaderboard", description: "Current standings of the running leaderboard" },
]

export async function registerCommands(): Promise<string[]> {
  const { applicationId, guildId } = discordConfig()
  const result = await discord<{ name: string }[]>("PUT", `/applications/${applicationId}/guilds/${guildId}/commands`, COMMANDS)
  return result.map((c) => `/${c.name}`)
}

// ─── Interaction plumbing ────────────────────────────────────

export type Interaction = {
  id: string
  application_id: string
  type: number
  token: string
  guild_id?: string
  data?: { name?: string; custom_id?: string; options?: Option[] }
  member?: { user: { id: string; username: string }; roles: string[] }
}
type Option = { name: string; type: number; value?: string | boolean; options?: Option[] }

/** Replaces the "thinking…" placeholder with the real answer. */
export async function editReply(interaction: Interaction, payload: Payload | string) {
  const body = typeof payload === "string" ? { content: payload } : payload
  await discord(
    "PATCH",
    `/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
    { ...body, allowed_mentions: { parse: [] } },
    { auth: false },
  )
}

function subcommand(interaction: Interaction): { name: string | null; get: (key: string) => any } {
  const top = interaction.data?.options ?? []
  const sub = top.find((o) => o.type === SUB)
  const opts = sub ? sub.options ?? [] : top
  return { name: sub?.name ?? null, get: (key) => opts.find((o) => o.name === key)?.value ?? undefined }
}

// "Name – Prize; Name2 – Prize2" → [{ name, prize }]
function parseWinners(input: string) {
  return String(input)
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, i) => {
      const [name, ...rest] = entry.split(/\s[–-]\s/)
      return { rank: i + 1, name: name.trim(), prize: rest.join(" - ").trim() || undefined }
    })
}

/** Commands that answer instantly, inside the three seconds. Returns null for the slow ones. */
export function quickReply(interaction: Interaction): Payload | null {
  if (interaction.data?.name === "links") {
    return {
      content: "🎁 **TrinidoRewards** – everything in one place:",
      components: [
        linkRow([
          { label: "Website", url: SITE_URL, emoji: "🎁" },
          { label: "Kick", url: kickUrl(), emoji: "📺" },
          { label: "Leaderboard", url: `${SITE_URL}/leaderboard`, emoji: "🏆" },
          { label: "Bonus Hunt", url: `${SITE_URL}/bonushunt`, emoji: "🎰" },
          { label: "Bonuses", url: `${SITE_URL}/bonuses`, emoji: "💎" },
        ]),
      ],
    }
  }
  return null
}

/** Is this command's answer visible to everyone? The rest are only shown to whoever asked. */
export const isPublic = (interaction: Interaction) => interaction.data?.name === "leaderboard"

/** The slow commands. Runs after the deferred response has gone out. */
export async function runCommand(interaction: Interaction): Promise<void> {
  const { guildId } = discordConfig()
  try {
    const reply = await execute(interaction, guildId)
    await editReply(interaction, reply)
  } catch (problem) {
    if (!(problem instanceof UserError)) console.error("[discord] command failed:", problem)
    const message = problem instanceof Error ? problem.message : "Unknown error"
    await editReply(interaction, `⚠️ ${message}`).catch(() => {})
  }
}

async function execute(interaction: Interaction, guildId: string): Promise<Payload | string> {
  const name = interaction.data?.name
  const { name: sub, get } = subcommand(interaction)

  if (name === "setup") {
    const ids = await getIds()
    const report = await buildServer(ids)
    await saveIds(ids)
    await postPanels(ids)
    await saveIds(ids)
    await logToDiscord(`🛠️ /setup run by ${interaction.member?.user.username ?? "?"}`)
    return [
      "✅ **Server is set up.**",
      report.created.length
        ? `Created: ${report.created.length} (${report.created.slice(0, 10).join(", ")}${report.created.length > 10 ? ", …" : ""})`
        : "Nothing new created.",
      `Updated: ${report.updated.length}`,
      "",
      "Old channels that aren't part of the blueprint are **not** deleted – you can clean those up yourself.",
    ].join("\n")
  }

  if (name === "announce") {
    let event: SiteEvent
    switch (sub) {
      case "leaderboard":
        event = {
          type: "leaderboard.created",
          data: {
            title: get("title"), prizePool: get("prizepool"), startsAt: get("start"), endsAt: get("end"),
            description: get("description"), url: get("link"), imageUrl: get("image"),
          },
        }
        break
      case "raffle":
        event = {
          type: "raffle.created",
          data: {
            title: get("title"), prize: get("prize"), endsAt: get("end"), howToEnter: get("howtoenter"),
            description: get("description"), url: get("link"), imageUrl: get("image"),
          },
        }
        break
      case "bonushunt":
        event = {
          type: "bonushunt.started",
          data: {
            title: get("title"), startBalance: get("startbalance"), bonusCount: get("bonuses"),
            description: get("description"), url: get("link"),
          },
        }
        break
      case "winners":
        event = { type: `${get("type")}.ended`, data: { title: get("title"), winners: parseWinners(get("winners")), url: get("link") } }
        break
      case "news":
        event = {
          type: "announcement",
          data: { title: get("title"), text: get("text"), url: get("link"), imageUrl: get("image"), ping: get("ping") ?? true },
        }
        break
      default:
        throw new UserError("Unknown subcommand.")
    }
    const msg = await handleEvent(event)
    return `✅ Posted: ${messageUrl(guildId, msg)}`
  }

  if (name === "live") {
    if (sub === "status") {
      const live = await getLive()
      const [channel, subs] = await Promise.all([
        fetchKickChannel().catch((e: Error) => e),
        listSubscriptions().catch((e: Error) => e),
      ])
      const subscribed =
        subs instanceof Error
          ? `❌ ${subs.message}`
          : subs.some((s) => s.event === "livestream.status.updated")
            ? "✅ active (Kick reports start/end via webhook)"
            : "❌ not subscribed – set it up under Discord in the admin"
      return [
        `**Channel:** kick.com/${KICK_SLUG}`,
        `**Webhook:** ${subscribed}`,
        `**Kick says right now:** ${channel instanceof Error ? `❌ ${channel.message}` : channel?.stream?.is_live ? "🔴 live" : "⚫ offline"}`,
        `**Bot's status:** ${live.isLive ? "🔴 live" : "⚫ offline"}`,
        live.isLive && live.startedAt ? `**Live since:** ${discordTime(live.startedAt, "R")}` : null,
        !live.isLive && live.endedAt ? `**Last ended:** ${discordTime(live.endedAt, "R")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    }
    // test
    const channel = await fetchKickChannel().catch(() => null)
    const stream = channel?.stream?.is_live
      ? streamInfo(channel)
      : { title: "Test run – this is what the live post looks like", category: "Slots & Casino", viewers: 123 }
    const logs = await channelId("logs")
    const msg = await discord<{ id: string; channel_id: string }>("POST", `/channels/${logs}/messages`, {
      ...liveMessage(stream, new Date().toISOString()),
      content: "🧪 **Preview** (no ping):",
      allowed_mentions: { parse: [] },
    })
    return `Preview posted: ${messageUrl(guildId, msg)}`
  }

  if (name === "leaderboard") {
    const standings = await currentStandings()
    if (!standings) return "No leaderboard is running right now. 🏆"
    return {
      embeds: [
        {
          color: COLORS.gold,
          title: `🏆 ${standings.title}`,
          url: `${SITE_URL}/leaderboard`,
          description: [
            `Ends ${discordTime(standings.endsAt, "R")} · Ranked by: ${standings.metric}`,
            "",
            ...(standings.lines.length ? standings.lines : ["No entries yet."]),
          ].join("\n"),
          footer: FOOTER,
          timestamp: new Date().toISOString(),
        },
      ],
      components: [linkRow([{ label: "Full leaderboard", url: `${SITE_URL}/leaderboard`, emoji: "🏆" }])],
    }
  }

  throw new UserError("Unknown command.")
}

// ─── Buttons ─────────────────────────────────────────────────

const PING_KEYS = new Set(PING_ROLES.map((r) => r.key))

export async function handleButton(interaction: Interaction): Promise<string> {
  const [, action, key] = (interaction.data?.custom_id ?? "").split(":")
  const { guildId } = discordConfig()
  const userId = interaction.member?.user.id
  const memberRoles = interaction.member?.roles ?? []
  if (!userId) return "This only works on the server."
  const ids = await getIds()
  const memberRole = (roleId: string) => `/guilds/${guildId}/members/${userId}/roles/${roleId}`

  if (action === "verify") {
    const roleId = ids.roles.verified
    if (!roleId) return "⚠️ The server isn't set up yet."
    if (memberRoles.includes(roleId)) return "You're already verified. 👍"
    await discord("PUT", memberRole(roleId), undefined, { reason: "Self-verification (18+ & rules)" })
    return "✅ Welcome! The server is now unlocked for you. Tip: pick your pings in 🔔│notifications."
  }

  if (action === "role" && PING_KEYS.has(key)) {
    const roleId = ids.roles[key]
    if (!roleId) return "⚠️ This role no longer exists – please let a mod know."
    const label = PING_ROLES.find((r) => r.key === key)!.name
    if (memberRoles.includes(roleId)) {
      await discord("DELETE", memberRole(roleId), undefined, { reason: "Ping role removed" })
      return `🔕 **${label}** removed.`
    }
    await discord("PUT", memberRole(roleId), undefined, { reason: "Ping role added" })
    return `🔔 **${label}** added.`
  }

  return "Unknown button."
}
