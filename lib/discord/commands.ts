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

export const COMMANDS = [
  {
    name: "setup",
    description: "Erstellt/aktualisiert Rollen, Kanäle und Panels des TrinidoRewards-Servers",
    default_member_permissions: ADMIN,
  },
  {
    name: "ankuendigen",
    description: "Manuelle Ankündigung posten (falls die Website nichts automatisch schickt)",
    default_member_permissions: MODS,
    options: [
      {
        type: SUB,
        name: "leaderboard",
        description: "Neues Leaderboard ankündigen",
        options: [
          str("titel", "z. B. Oktober Leaderboard", true),
          str("preispool", "z. B. 1.000 €"),
          str("start", "TT.MM.JJJJ HH:MM"),
          str("ende", "TT.MM.JJJJ HH:MM"),
          str("beschreibung", "Zusätzlicher Text"),
          str("link", "Standard: /leaderboard"),
          str("bild", "Bild-URL (optional)"),
        ],
      },
      {
        type: SUB,
        name: "raffle",
        description: "Neues Raffle ankündigen",
        options: [
          str("titel", "z. B. 100 € Weekend Raffle", true),
          str("preis", "Was gibt es zu gewinnen?"),
          str("ende", "TT.MM.JJJJ HH:MM"),
          str("teilnahme", "Wie macht man mit?"),
          str("beschreibung", "Zusätzlicher Text"),
          str("link", "Link zum Raffle"),
          str("bild", "Bild-URL (optional)"),
        ],
      },
      {
        type: SUB,
        name: "bonushunt",
        description: "Bonus Hunt starten",
        options: [
          str("titel", "z. B. Bonus Hunt #42", true),
          str("startbalance", "z. B. 2.500 €"),
          str("boni", "Anzahl Boni"),
          str("beschreibung", "Zusätzlicher Text"),
          str("link", "Standard: /bonushunt"),
        ],
      },
      {
        type: SUB,
        name: "gewinner",
        description: "Gewinner eines Raffles oder Leaderboards posten",
        options: [
          {
            type: STRING,
            name: "typ",
            description: "Wofür?",
            required: true,
            choices: [
              { name: "Raffle", value: "raffle" },
              { name: "Leaderboard", value: "leaderboard" },
            ],
          },
          str("titel", "Name des Raffles/Leaderboards", true),
          str("gewinner", "Format: Name – Preis; Name2 – Preis2", true),
          str("link", "Link (optional)"),
        ],
      },
      {
        type: SUB,
        name: "news",
        description: "Allgemeine Ankündigung",
        options: [
          str("titel", "Überschrift", true),
          str("text", "Inhalt", true),
          str("link", "Link (optional)"),
          str("bild", "Bild-URL (optional)"),
          { type: BOOLEAN, name: "ping", description: "News-Ping-Rolle pingen? (Standard: ja)" },
        ],
      },
    ],
  },
  {
    name: "live",
    description: "Kick-Live-Benachrichtigung prüfen",
    default_member_permissions: MODS,
    options: [
      { type: SUB, name: "status", description: "Zeigt, was der Bot gerade über den Kick-Kanal weiß" },
      { type: SUB, name: "test", description: "Postet eine Vorschau der Live-Nachricht in #bot-logs (ohne Ping)" },
    ],
  },
  { name: "links", description: "Alle wichtigen TrinidoRewards-Links" },
  { name: "leaderboard", description: "Der aktuelle Stand des laufenden Leaderboards" },
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

// "Name – Preis; Name2 – Preis2" → [{ name, prize }]
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
      content: "🎁 **TrinidoRewards** – alles an einem Ort:",
      components: [
        linkRow([
          { label: "Website", url: SITE_URL, emoji: "🎁" },
          { label: "Kick", url: kickUrl(), emoji: "📺" },
          { label: "Leaderboard", url: `${SITE_URL}/leaderboard`, emoji: "🏆" },
          { label: "Bonus Hunt", url: `${SITE_URL}/bonushunt`, emoji: "🎰" },
          { label: "Boni", url: `${SITE_URL}/bonuses`, emoji: "💎" },
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
    const message = problem instanceof Error ? problem.message : "Unbekannter Fehler"
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
    await logToDiscord(`🛠️ /setup ausgeführt von ${interaction.member?.user.username ?? "?"}`)
    return [
      "✅ **Server ist eingerichtet.**",
      report.created.length
        ? `Neu erstellt: ${report.created.length} (${report.created.slice(0, 10).join(", ")}${report.created.length > 10 ? ", …" : ""})`
        : "Nichts neu erstellt.",
      `Aktualisiert: ${report.updated.length}`,
      "",
      "Alte Kanäle, die nicht zum Bauplan gehören, werden **nicht** gelöscht – die kannst du selbst aufräumen.",
    ].join("\n")
  }

  if (name === "ankuendigen") {
    let event: SiteEvent
    switch (sub) {
      case "leaderboard":
        event = {
          type: "leaderboard.created",
          data: {
            title: get("titel"), prizePool: get("preispool"), startsAt: get("start"), endsAt: get("ende"),
            description: get("beschreibung"), url: get("link"), imageUrl: get("bild"),
          },
        }
        break
      case "raffle":
        event = {
          type: "raffle.created",
          data: {
            title: get("titel"), prize: get("preis"), endsAt: get("ende"), howToEnter: get("teilnahme"),
            description: get("beschreibung"), url: get("link"), imageUrl: get("bild"),
          },
        }
        break
      case "bonushunt":
        event = {
          type: "bonushunt.started",
          data: {
            title: get("titel"), startBalance: get("startbalance"), bonusCount: get("boni"),
            description: get("beschreibung"), url: get("link"),
          },
        }
        break
      case "gewinner":
        event = { type: `${get("typ")}.ended`, data: { title: get("titel"), winners: parseWinners(get("gewinner")), url: get("link") } }
        break
      case "news":
        event = {
          type: "announcement",
          data: { title: get("titel"), text: get("text"), url: get("link"), imageUrl: get("bild"), ping: get("ping") ?? true },
        }
        break
      default:
        throw new UserError("Unbekannter Unterbefehl.")
    }
    const msg = await handleEvent(event)
    return `✅ Gepostet: ${messageUrl(guildId, msg)}`
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
            ? "✅ aktiv (Kick meldet Start/Ende per Webhook)"
            : "❌ nicht abonniert – im Admin unter Discord einrichten"
      return [
        `**Kanal:** kick.com/${KICK_SLUG}`,
        `**Webhook:** ${subscribed}`,
        `**Kick sagt gerade:** ${channel instanceof Error ? `❌ ${channel.message}` : channel?.stream?.is_live ? "🔴 live" : "⚫ offline"}`,
        `**Status laut Bot:** ${live.isLive ? "🔴 live" : "⚫ offline"}`,
        live.isLive && live.startedAt ? `**Live seit:** ${discordTime(live.startedAt, "R")}` : null,
        !live.isLive && live.endedAt ? `**Zuletzt beendet:** ${discordTime(live.endedAt, "R")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    }
    // test
    const channel = await fetchKickChannel().catch(() => null)
    const stream = channel?.stream?.is_live
      ? streamInfo(channel)
      : { title: "Testlauf – so sieht die Live-Nachricht aus", category: "Slots & Casino", viewers: 123 }
    const logs = await channelId("logs")
    const msg = await discord<{ id: string; channel_id: string }>("POST", `/channels/${logs}/messages`, {
      ...liveMessage(stream, new Date().toISOString()),
      content: "🧪 **Vorschau** (kein Ping):",
      allowed_mentions: { parse: [] },
    })
    return `Vorschau gepostet: ${messageUrl(guildId, msg)}`
  }

  if (name === "leaderboard") {
    const standings = await currentStandings()
    if (!standings) return "Gerade läuft kein Leaderboard. 🏆"
    return {
      embeds: [
        {
          color: COLORS.gold,
          title: `🏆 ${standings.title}`,
          url: `${SITE_URL}/leaderboard`,
          description: [
            `Endet ${discordTime(standings.endsAt, "R")} · Wertung: ${standings.metric}`,
            "",
            ...(standings.lines.length ? standings.lines : ["Noch keine Einträge."]),
          ].join("\n"),
          footer: FOOTER,
          timestamp: new Date().toISOString(),
        },
      ],
      components: [linkRow([{ label: "Ganzes Leaderboard", url: `${SITE_URL}/leaderboard`, emoji: "🏆" }])],
    }
  }

  throw new UserError("Unbekannter Befehl.")
}

// ─── Buttons ─────────────────────────────────────────────────

const PING_KEYS = new Set(PING_ROLES.map((r) => r.key))

export async function handleButton(interaction: Interaction): Promise<string> {
  const [, action, key] = (interaction.data?.custom_id ?? "").split(":")
  const { guildId } = discordConfig()
  const userId = interaction.member?.user.id
  const memberRoles = interaction.member?.roles ?? []
  if (!userId) return "Das geht nur auf dem Server."
  const ids = await getIds()
  const memberRole = (roleId: string) => `/guilds/${guildId}/members/${userId}/roles/${roleId}`

  if (action === "verify") {
    const roleId = ids.roles.verified
    if (!roleId) return "⚠️ Der Server ist noch nicht eingerichtet."
    if (memberRoles.includes(roleId)) return "Du bist bereits freigeschaltet. 👍"
    await discord("PUT", memberRole(roleId), undefined, { reason: "Selbst-Verifizierung (18+ & Regeln)" })
    return "✅ Willkommen! Der Server ist jetzt für dich freigeschaltet. Tipp: Hol dir unter 🔔│benachrichtigungen deine Pings."
  }

  if (action === "role" && PING_KEYS.has(key)) {
    const roleId = ids.roles[key]
    if (!roleId) return "⚠️ Diese Rolle existiert nicht mehr – bitte einem Mod Bescheid geben."
    const label = PING_ROLES.find((r) => r.key === key)!.name
    if (memberRoles.includes(roleId)) {
      await discord("DELETE", memberRole(roleId), undefined, { reason: "Ping-Rolle abgewählt" })
      return `🔕 **${label}** entfernt.`
    }
    await discord("PUT", memberRole(roleId), undefined, { reason: "Ping-Rolle gewählt" })
    return `🔔 **${label}** hinzugefügt.`
  }

  return "Unbekannter Button."
}

