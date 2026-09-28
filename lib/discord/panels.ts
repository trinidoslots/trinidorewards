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
        title: "👋 Willkommen bei TrinidoRewards!",
        description: [
          "Hier bekommst du alles rund um den Stream von **TrinidoSlots** auf Kick:",
          "",
          `🔴 Live-Benachrichtigungen in ${ch("live")}`,
          `🏆 Neue Leaderboards in ${ch("leaderboard")}`,
          `🎟️ Raffles & Gewinner in ${ch("raffle")}`,
          `🎰 Bonus Hunts in ${ch("bonushunt")}`,
          "",
          `**So geht's los:** Lies ${ch("rules")} und bestätige in ${ch("verify")}, dass du 18+ bist.`,
          `Danach kannst du in ${ch("roles")} auswählen, wofür du gepingt werden willst.`,
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
        title: "📜 Serverregeln",
        description: [
          "**1. Nur ab 18.** Hier geht es um Glücksspiel-Content. Minderjährige werden entfernt.",
          "**2. Respekt.** Keine Beleidigungen, kein Hass, keine Diskriminierung, kein Flamen.",
          "**3. Kein Spam & keine Werbung.** Keine fremden Casino-Links, Referral-Codes, Server-Einladungen oder Eigenwerbung.",
          "**4. Kein Betteln.** Nicht nach Geld, Tipps, Accounts oder Giveaways fragen.",
          "**5. Vorsicht vor Scams.** Das Team fragt **nie** per DM nach Passwörtern, Wallet-Daten oder Zahlungen. Gewinne werden ausschließlich über das Log auf trinidorewards.com abgewickelt.",
          "**6. Keine persönlichen Daten** – weder deine noch die anderer.",
          "**7. Mods haben das letzte Wort.** Fragen dazu gerne in den Hilfe-Kanal.",
          "",
          `Es gelten zusätzlich die [Discord-Richtlinien](https://discord.com/guidelines) und die [Nutzungsbedingungen von TrinidoRewards](${SITE_URL}/terms).`,
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
        title: "✅ Server freischalten",
        description: `Mit dem Klick unten bestätigst du, dass du **mindestens 18 Jahre alt** bist und die Regeln in ${ch("rules")} akzeptierst.`,
        footer: FOOTER,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, custom_id: "trinido:verify", label: "Ich bin 18+ & akzeptiere die Regeln", emoji: { name: "✅" } },
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
        title: "🔔 Benachrichtigungen",
        description: [
          "Klick auf einen Button, um die Rolle zu bekommen – nochmal klicken entfernt sie wieder.",
          "",
          ...PING_ROLES.map((r) => `${r.emoji} **${r.label}** – Ping ${r.hint}`),
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
        title: "🛟 Verantwortungsvoll spielen",
        description: [
          "Glücksspiel ist Unterhaltung – kein Weg, Geld zu verdienen.",
          "",
          "• Setz dir **vorher** ein Zeit- und Geldlimit und halte dich daran.",
          "• Spiel nur mit Geld, dessen Verlust du dir leisten kannst.",
          "• Jag Verlusten nicht hinterher.",
          "• Pausen einlegen – und aufhören, wenn es keinen Spaß mehr macht.",
          "",
          "**Hilfe in Deutschland:** kostenlose & anonyme Beratung unter **0800 1 37 27 00** oder auf check-dein-spiel.de.",
          "**Spielersperre (DE):** Über das OASIS-Sperrsystem kannst du dich bei allen legalen Anbietern sperren lassen.",
          "**International:** begambleaware.org",
          "",
          "Wenn du dir Sorgen machst, schreib gern einem Mod – vertraulich.",
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
