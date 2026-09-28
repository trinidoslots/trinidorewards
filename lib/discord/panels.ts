import { discord } from "@/lib/discord/rest"
import { PING_ROLES } from "@/lib/discord/blueprint"
import { SITE_URL, kickUrl } from "@/lib/discord/config"
import { COLORS, FOOTER, linkRow, type Payload } from "@/lib/discord/embeds"
import type { Ids } from "@/lib/discord/state"

/** The fixed posts in the START and news channels. Edited in place on every /setup, never duplicated. */

async function upsertPanel(ids: Ids, channelKey: string, panelKey: string, payload: Payload) {
  const channel = ids.channels[channelKey]
  const existing = ids.panels[panelKey]
  const body = { ...payload, allowed_mentions: { parse: [] } }
  if (existing) {
    try {
      await discord("PATCH", `/channels/${channel}/messages/${existing}`, body)
      return
    } catch {
      /* deleted by hand – post a fresh one */
    }
  }
  const msg = await discord<{ id: string }>("POST", `/channels/${channel}/messages`, body)
  ids.panels[panelKey] = msg.id
}

function welcome(ch: (key: string) => string): Payload {
  return {
    embeds: [
      {
        color: COLORS.kick,
        title: "👋 Welcome to TrinidoRewards!",
        description: [
          "Everything around **TrinidoSlots**' stream on Kick, in one place:",
          "",
          `🔴 Live notifications in ${ch("live")}`,
          `🏆 New leaderboards in ${ch("leaderboard")}`,
          `🎟️ Raffles & winners in ${ch("raffle")}`,
          `🎰 Bonus hunts in ${ch("bonushunt")}`,
          "",
          `**Getting started:** read ${ch("rules")} and confirm in ${ch("verify")} that you are 18+.`,
          `Then pick what you want to be pinged for in ${ch("roles")}.`,
        ].join("\n"),
        footer: FOOTER,
      },
    ],
    components: [
      linkRow([
        { label: "Website", url: SITE_URL, emoji: "🎁" },
        { label: "Kick", url: kickUrl(), emoji: "📺" },
        { label: "Leaderboard", url: `${SITE_URL}/leaderboard`, emoji: "🏆" },
        { label: "Bonus Hunt", url: `${SITE_URL}/bonushunt`, emoji: "🎰" },
      ]),
    ],
  }
}

function rules(): Payload {
  return {
    embeds: [
      {
        color: COLORS.news,
        title: "📜 Server rules",
        description: [
          "**1. 18+ only.** This is gambling content. Minors will be removed.",
          "**2. Respect.** No insults, hate, discrimination or flaming.",
          "**3. No spam & no advertising.** No other casino links, referral codes, server invites or self-promotion.",
          "**4. No begging.** Don't ask for money, tips, accounts or giveaways.",
          "**5. Beware of scams.** The team will **never** DM you asking for passwords, wallet details or payments. Winnings are only handled through the log on trinidorewards.com.",
          "**6. No personal data** – neither yours nor anyone else's.",
          "**7. Mods have the final say.** Questions about that are welcome in the help channel.",
          "",
          `The [Discord Guidelines](https://discord.com/guidelines) and the [TrinidoRewards terms](${SITE_URL}/terms) also apply.`,
        ].join("\n"),
        footer: FOOTER,
      },
    ],
  }
}

function verify(ch: (key: string) => string): Payload {
  return {
    embeds: [
      {
        color: COLORS.kick,
        title: "✅ Unlock the server",
        description: `By clicking below you confirm that you are **at least 18 years old** and accept the rules in ${ch("rules")}.`,
        footer: FOOTER,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, custom_id: "trinido:verify", label: "I'm 18+ & accept the rules", emoji: { name: "✅" } },
        ],
      },
    ],
  }
}

function pingRoles(): Payload {
  return {
    embeds: [
      {
        color: COLORS.news,
        title: "🔔 Notifications",
        description: [
          "Click a button to get the role – click it again to remove it.",
          "",
          ...PING_ROLES.map((r) => `${r.emoji} **${r.label}** – ping ${r.hint}`),
        ].join("\n"),
        footer: FOOTER,
      },
    ],
    components: [
      {
        type: 1,
        components: PING_ROLES.slice(0, 5).map((r) => ({
          type: 2,
          style: 2,
          custom_id: `trinido:role:${r.key}`,
          label: r.label,
          emoji: { name: r.emoji },
        })),
      },
    ],
  }
}

function responsible(): Payload {
  return {
    embeds: [
      {
        color: COLORS.ended,
        title: "🛟 Gamble responsibly",
        description: [
          "Gambling is entertainment – not a way to make money.",
          "",
          "• Set a time and money limit **before** you play, and stick to it.",
          "• Only play with money you can afford to lose.",
          "• Don't chase losses.",
          "• Take breaks – and stop when it stops being fun.",
          "",
          "**Help in Germany:** free & anonymous advice at **0800 1 37 27 00** or check-dein-spiel.de.",
          "**Self-exclusion (DE):** the OASIS system lets you block yourself at all licensed operators.",
          "**International:** begambleaware.org",
          "",
          "If you're worried, message a mod – in confidence.",
        ].join("\n"),
        footer: FOOTER,
      },
    ],
    components: [
      linkRow([
        { label: "check-dein-spiel.de", url: "https://www.check-dein-spiel.de/", emoji: "💬" },
        { label: "BeGambleAware", url: "https://www.gambleaware.org/", emoji: "🌍" },
      ]),
    ],
  }
}

/** Posts or refreshes every panel. Mutates `ids.panels`; the caller saves. */
export async function postPanels(ids: Ids): Promise<void> {
  const ch = (key: string) => `<#${ids.channels[key]}>`
  await upsertPanel(ids, "welcome", "welcome", welcome(ch))
  await upsertPanel(ids, "rules", "rules", rules())
  await upsertPanel(ids, "verify", "verify", verify(ch))
  await upsertPanel(ids, "roles", "roles", pingRoles())
  await upsertPanel(ids, "responsible", "responsible", responsible())
}
