// Palette and metrics for the /obs/stream column.
//
// Matches the bonus hunt widget (app/obs/bonushunt/page.tsx) so the two sources
// look like one overlay when they sit on the same scene: #4D84FF on near-black,
// with #7FB3FF for labels and #B18CFF for the giveaway's highlights.
//
// Kept here rather than inline so the event cards, the giveaway card and the
// chat feed cannot drift apart.

export const OBS = {
  /** The column itself. Translucent so the stream shows through a little. */
  shell: "rgba(11, 14, 19, 0.92)",

  /** Event cards lifted off the column. */
  card: "rgba(26, 31, 43, 0.88)",
  cardBorder: "rgba(77, 132, 255, 0.26)",

  /** The rounded tile the icon sits in, on the left of every card. */
  iconTile: "rgba(77, 132, 255, 0.14)",

  /** Small uppercase label above the value. */
  label: "#7FB3FF",
  /** The value itself. */
  value: "#FFFFFF",
  /** Supporting line under the value, and timestamps. */
  muted: "#8296B5",
  /** Chat body text. */
  chatText: "#D7E2F2",
  /** Links, e.g. a code-drop URL. */
  link: "#7FB3FF",

  deposit: "#FB7185",
  cashout: "#34D399",
} as const

/**
 * Corner radii, in pixels. Kept together because the column, the cards and the
 * tile inside each card have to stay in proportion — bumping one alone makes
 * the stack look uneven.
 */
export const OBS_RADIUS = {
  /**
   * Square. The column is a browser source butted against the edge of a scene,
   * so rounding it would just cut the background away at the corners — the
   * rounding belongs on the cards inside it.
   */
  shell: 0,
  card: 12,
  banner: 12,
  iconTile: 9,
  /** Inner panels: the keyword box, the roll strip. */
  panel: 9,
  badge: 4,
} as const

/** Chat body size. Bumped from 13px — 13 was too small to read on stream. */
export const CHAT_FONT_PX = 15
/** Emotes ride a little above the cap height, as they do on Kick itself. */
export const CHAT_EMOTE_PX = 26
