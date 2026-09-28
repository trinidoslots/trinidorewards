/**
 * The server layout. Names, colours and channels can be changed here; /setup
 * creates what is missing and corrects what exists, so it can be run any
 * number of times.
 */

// Discord permission bits. BigInt because several sit above bit 31.
const bit = (n: number) => BigInt(1) << BigInt(n)
export const P = {
  KickMembers: bit(1),
  AddReactions: bit(6),
  Stream: bit(9),
  ViewChannel: bit(10),
  SendMessages: bit(11),
  ManageMessages: bit(13),
  EmbedLinks: bit(14),
  AttachFiles: bit(15),
  ReadMessageHistory: bit(16),
  MentionEveryone: bit(17),
  Connect: bit(20),
  Speak: bit(21),
  MuteMembers: bit(22),
  MoveMembers: bit(24),
  UseVAD: bit(25),
  ManageRoles: bit(28),
  ManageThreads: bit(34),
  CreatePublicThreads: bit(35),
  CreatePrivateThreads: bit(36),
  SendMessagesInThreads: bit(38),
  ModerateMembers: bit(40),
} as const

export const perms = (...flags: bigint[]) => flags.reduce((sum, flag) => sum | flag, BigInt(0)).toString()

export type PingRole = { key: string; name: string; emoji: string; label: string; hint: string }

// Roles members can give themselves with a button.
export const PING_ROLES: PingRole[] = [
  { key: "pingLive", name: "🔴 Live-Ping", emoji: "🔴", label: "Live", hint: "wenn der Stream startet" },
  { key: "pingLeaderboard", name: "🏆 Leaderboard-Ping", emoji: "🏆", label: "Leaderboards", hint: "bei neuen Leaderboards" },
  { key: "pingRaffle", name: "🎟️ Raffle-Ping", emoji: "🎟️", label: "Raffles", hint: "bei neuen Raffles" },
  { key: "pingHunt", name: "🎰 Bonus-Hunt-Ping", emoji: "🎰", label: "Bonus Hunts", hint: "wenn ein Bonus Hunt startet" },
  { key: "pingNews", name: "📰 News-Ping", emoji: "📰", label: "News", hint: "bei wichtigen Ankündigungen" },
]

export type RoleDef = { key: string; name: string; color: number; hoist?: boolean; permissions?: string }

export const ROLES: RoleDef[] = [
  {
    key: "mod",
    name: "🛡️ Moderator",
    color: 0x53fc18,
    hoist: true,
    permissions: perms(P.ManageMessages, P.ModerateMembers, P.KickMembers, P.MuteMembers, P.MoveMembers, P.ManageThreads),
  },
  { key: "verified", name: "✅ Verifiziert", color: 0x99aab5 },
  ...PING_ROLES.map((r) => ({ key: r.key, name: r.name, color: 0x5865f2 })),
]

/**
 * info  – visible to everyone, read only (the START area)
 * news  – verified only, read only (bot and mods post)
 * chat  – verified only, read and write
 * voice – verified only, voice channel
 * team  – moderators only
 */
export type Access = "info" | "news" | "chat" | "voice" | "team"
export type ChannelDef = { key: string; name: string; access: Access; topic?: string; type?: "voice" }
export type CategoryDef = { key: string; name: string; access: Access; channels: ChannelDef[] }

export const CATEGORIES: CategoryDef[] = [
  {
    key: "start",
    name: "📌 START",
    access: "info",
    channels: [
      { key: "welcome", name: "👋│willkommen", access: "info", topic: "Willkommen in der TrinidoRewards-Community!" },
      { key: "rules", name: "📜│regeln", access: "info", topic: "Bitte lesen – gilt für alle." },
      { key: "verify", name: "✅│verifizieren", access: "info", topic: "Bestätige hier, dass du 18+ bist, um den Server freizuschalten." },
      { key: "responsible", name: "🛟│verantwortungsvoll-spielen", access: "info", topic: "Hilfe, Limits und Beratungsstellen." },
    ],
  },
  {
    key: "news",
    name: "📢 TRINIDO NEWS",
    access: "news",
    channels: [
      { key: "live", name: "🔴│live", access: "news", topic: "Automatische Benachrichtigung, sobald der Stream auf Kick startet." },
      { key: "leaderboard", name: "🏆│leaderboards", access: "news", topic: "Neue Leaderboards und Gewinner – trinidorewards.com/leaderboard" },
      { key: "raffle", name: "🎟️│raffles", access: "news", topic: "Neue Raffles und Gewinner." },
      { key: "bonushunt", name: "🎰│bonus-hunts", access: "news", topic: "Bonus Hunts – Balance tippen auf trinidorewards.com/bonushunt" },
      { key: "news", name: "📰│ankündigungen", access: "news", topic: "Wichtige Neuigkeiten." },
      { key: "roles", name: "🔔│benachrichtigungen", access: "news", topic: "Wähle, wofür du gepingt werden willst." },
    ],
  },
  {
    key: "community",
    name: "💬 COMMUNITY",
    access: "chat",
    channels: [
      { key: "chat", name: "💬│chat", access: "chat", topic: "Allgemeiner Chat." },
      { key: "wins", name: "🏅│big-wins", access: "chat", topic: "Zeig deine Gewinne – Screenshots erwünscht." },
      { key: "clips", name: "🎬│clips", access: "chat", topic: "Die besten Stream-Momente." },
      { key: "ideas", name: "💡│vorschläge", access: "chat", topic: "Ideen für Stream, Seite und Server." },
      { key: "help", name: "❓│hilfe", access: "chat", topic: "Fragen zu Raffles, Leaderboards oder Auszahlungen." },
    ],
  },
  {
    key: "voice",
    name: "🎙️ VOICE",
    access: "voice",
    channels: [
      { key: "vc_lounge", name: "🔊 Lounge", access: "voice", type: "voice" },
      { key: "vc_stream", name: "📺 Stream-Talk", access: "voice", type: "voice" },
    ],
  },
  {
    key: "team",
    name: "🛡️ TEAM",
    access: "team",
    channels: [
      { key: "modchat", name: "🛡️│mod-chat", access: "team", topic: "Nur für das Team." },
      { key: "logs", name: "🤖│bot-logs", access: "team", topic: "Protokoll des Bots (Setup, Live-Status, Website-Events)." },
    ],
  },
]

export type Overwrite = { id: string; type: 0 | 1; allow?: string; deny?: string }

const READ = [P.ViewChannel, P.ReadMessageHistory]
const NO_WRITE = [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads, P.SendMessagesInThreads]
const BOT = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.MentionEveryone, P.ManageMessages]

/** Channel permissions for one access level. The @everyone role's id is the guild's id. */
export function buildOverwrites(guildId: string, botId: string, roles: Record<string, string>, access: Access): Overwrite[] {
  const everyone = guildId
  const role = (id: string, allow: bigint[] = [], deny: bigint[] = []): Overwrite => ({
    id,
    type: 0,
    allow: perms(...allow),
    deny: perms(...deny),
  })
  const bot: Overwrite = { id: botId, type: 1, allow: perms(...BOT), deny: "0" }
  const { mod, verified } = roles

  switch (access) {
    case "info":
      return [role(everyone, READ, [...NO_WRITE, P.AddReactions]), role(mod, [P.SendMessages]), bot]
    case "news":
      return [
        role(everyone, [], [P.ViewChannel]),
        role(verified, [...READ, P.AddReactions], NO_WRITE),
        role(mod, [...READ, P.SendMessages]),
        bot,
      ]
    case "chat":
      return [
        role(everyone, [], [P.ViewChannel]),
        role(verified, [
          ...READ,
          P.SendMessages,
          P.EmbedLinks,
          P.AttachFiles,
          P.AddReactions,
          P.SendMessagesInThreads,
          P.CreatePublicThreads,
        ]),
        role(mod, [...READ, P.SendMessages]),
        bot,
      ]
    case "voice":
      return [
        role(everyone, [], [P.ViewChannel]),
        role(verified, [P.ViewChannel, P.Connect, P.Speak, P.Stream, P.UseVAD]),
        role(mod, [P.ViewChannel, P.Connect, P.Speak]),
        bot,
      ]
    case "team":
      return [
        role(everyone, [], [P.ViewChannel]),
        role(mod, [...READ, P.SendMessages, P.AttachFiles, P.EmbedLinks]),
        bot,
      ]
  }
}
