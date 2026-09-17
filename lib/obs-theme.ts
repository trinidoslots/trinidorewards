// Palette for the /obs/stream column.
//
// Deliberately NOT the site's blue-grey admin theme: this sits on top of the
// stream next to the Kick chat, and is styled after the overlay look the
// channel already uses — a deep violet column with softly lifted cards.
//
// Kept here rather than inline so the event cards, the giveaway card and the
// chat feed cannot drift apart.

export const OBS = {
  /** The column itself. Translucent so the stream shows through a little. */
  shell: "rgba(30, 18, 54, 0.90)",
  shellBorder: "rgba(150, 120, 230, 0.22)",

  /** Event cards lifted off the column. */
  card: "rgba(62, 47, 110, 0.72)",
  cardBorder: "rgba(168, 146, 240, 0.20)",

  /** The rounded tile the icon sits in, on the left of every card. */
  iconTile: "rgba(255, 255, 255, 0.10)",

  /** Small uppercase label above the value. */
  label: "#B4A6E4",
  /** The value itself. */
  value: "#FFFFFF",
  /** Supporting line under the value, and timestamps. */
  muted: "#9A8CC4",
  /** Links, e.g. a code-drop URL. */
  link: "#9BB0FF",

  deposit: "#FF6B8A",
  cashout: "#45E0A8",
} as const

/** Chat body size. Bumped from 13px — 13 was too small to read on stream. */
export const CHAT_FONT_PX = 15
/** Emotes ride a little above the cap height, as they do on Kick itself. */
export const CHAT_EMOTE_PX = 26
