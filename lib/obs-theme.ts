// Palette and metrics for the /obs/stream column.
//
// Matches the bonus hunt widget (app/obs/hunt/page.tsx) so the two sources
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

/**
 * Chat body size. 13 -> 15 -> 18: still too small to read back from a phone at
 * 15, and the column is narrow enough that 18 is the practical ceiling before
 * usernames start wrapping.
 */
export const CHAT_FONT_PX = 18
/**
 * Emotes ride a little above the cap height, as they do on Kick itself. Scaled
 * with the body text so they keep the same proportion (was 26 at 15px).
 */
export const CHAT_EMOTE_PX = 31

/**
 * One gradient down the whole 1080 of the combined scene, rendered in two
 * pieces because the top bar and the columns are separate sources.
 *
 * Three separately-painted panels read as three widgets that happen to be
 * adjacent. The bar paints the top 50px of the scene gradient and each column
 * continues from exactly where it left off, so there is no seam to see.
 *
 * SEAM is not a colour anybody picked: it is the gradient sampled at
 * 50/1080 = 4.63% of the way down, which is where the bar ends. Eyeballing it
 * is how the two halves drift apart the next time one of them is touched.
 *
 * The bar's gradient used to run left-to-right, #1A1F2B to #0B0E13, which is
 * why this needed doing at all: a column could meet it at the left edge or the
 * right, never both.
 *
 * Alpha stays near the 0.92 the flat shell used. An overlay that is completely
 * opaque cuts a hole in the capture behind it.
 */
export const SCENE_TOP = "rgba(26, 31, 43, 0.95)"
export const SCENE_SEAM = "rgba(25, 30, 42, 0.949)"
export const SCENE_BASE = "rgba(11, 11, 13, 0.92)"

/** The top bar: the first 50px of the scene gradient. */
export const TOP_BAR_GRADIENT = `linear-gradient(to bottom, ${SCENE_TOP}, ${SCENE_SEAM})`

/** Each column: the remaining 1030. */
export const COLUMN_GRADIENT = `linear-gradient(to bottom, ${SCENE_SEAM} 0%, ${SCENE_BASE} 100%)`

/** The hairline down the inner edge of each column, as on the site. */
export const COLUMN_EDGE = "rgba(255, 255, 255, 0.08)"

/**
 * A widget paints its own background unless it is told not to.
 *
 * /obs/complete passes ?transparent=1 so the gradient it draws behind the
 * column is not hidden under the widget's own 92%-opaque shell.
 */
export function shellBackground(transparent: boolean): string {
  return transparent ? "transparent" : OBS.shell
}
