// Palette and metrics for the OBS sources.
//
// The overlay used to have a palette of its own — a blue wash over everything,
// #4D84FF borders, #7FB3FF labels, #B18CFF highlights, cards on #1A1F2B. It
// looked like a different product from the site it belongs to.
//
// It is the site's surface language now: near-black ground, white hairlines
// rather than coloured ones, and one accent per card carried on a left edge
// instead of tinting the whole card. ACCENTS is imported rather than restated
// so the overlay cannot drift off the palette the site uses.

import { ACCENTS } from "@/components/ui/panel"

/**
 * The side columns' surface.
 *
 * Darker than the top bar on purpose, so the two columns read as panels sitting
 * on the scene rather than as more of the bar. It is also the exact colour the
 * scene background starts from in its top-left corner, which is what makes the
 * hunt column disappear into the background up there instead of ending in a
 * visible rectangle.
 *
 * Alpha stays below 1: an overlay that is completely opaque cuts a hole in the
 * capture behind it.
 */
const COLUMN_SURFACE = "rgba(15, 18, 26, 0.95)"

export const OBS = {
  /** The column itself. Translucent so the stream shows through a little. */
  shell: COLUMN_SURFACE,

  /** Event cards lifted off the column — the site's Panel surface. */
  card: "rgba(255, 255, 255, 0.022)",
  cardBorder: "rgba(255, 255, 255, 0.08)",

  /**
   * A block that has to read as a box, not as a hint of one.
   *
   * `card` above is 2.2% white, which is the site's Panel — right on a page
   * you are reading a foot away, and all but invisible over a stream at a
   * glance. The hunt column's KPI block and its bonus cards use this instead.
   *
   * Built from OUR blue, not from the reference's violet and not from white.
   *
   * The reference's box solves back to its own accent at about 20% over its
   * own ground — that is the part worth taking, a lift made of the palette
   * rather than a grey one. Its actual violet belongs to its palette, not
   * this one.
   *
   * White is the other wrong answer, and less obviously so: this column's
   * surface is a blue-black, and a white overlay pulls it toward neutral
   * grey. The box then sits on the column looking like a different material
   * instead of a lit part of the same one.
   *
   * The gradient is lighter along the top edge, so the box has a lit side
   * instead of being one flat rectangle.
   */
  raised: `linear-gradient(color-mix(in srgb, ${ACCENTS.blue} 18%, transparent), color-mix(in srgb, ${ACCENTS.blue} 10%, transparent))`,
  raisedBorder: `color-mix(in srgb, ${ACCENTS.blue} 30%, transparent)`,

  /** The tile the icon sits in. A hairline box, not a coloured block. */
  iconTile: "rgba(255, 255, 255, 0.04)",

  /** Fallback for a card that names no accent of its own. */
  label: ACCENTS.blue,
  /** The value itself — the site's own text colour, not pure white. */
  value: "#E7E7EA",
  /** Supporting line under the value, and timestamps. */
  muted: "rgba(255, 255, 255, 0.35)",
  /** Chat body text. */
  chatText: "rgba(255, 255, 255, 0.75)",
  /** Links, e.g. a code-drop URL. */
  link: ACCENTS.blue,

  /** Money out and money in, in the site's red and green. */
  deposit: ACCENTS.red,
  cashout: ACCENTS.green,

  /** One accent per kind of event, as the site gives one per card. */
  prediction: ACCENTS.amber,
  tournament: ACCENTS.blue,
  giveaway: ACCENTS.purple,
  // The one ACCENT not already spoken for by another event card, so a points
  // payout is never mistaken at a glance for a giveaway or a cashout.
  points: ACCENTS.pink,
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
  // No `banner`: the banner artwork carries its own corners and its own
  // background, so the rotator draws no shell at all.
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

/** The top bar: unchanged, and the one surface in the scene that is. */
export const TOP_BAR_GRADIENT = `linear-gradient(to bottom, ${SCENE_TOP}, ${SCENE_SEAM})`

/**
 * Each column.
 *
 * No longer continues the bar's gradient — the columns are deliberately darker
 * than the bar now, so there is a step at the seam where there used to be none.
 * That step is the point: it is what separates the bar from the panels under it.
 * The hairline the bar draws along its own bottom edge is still suppressed when
 * embedded, so the step is a change in tone and not a line.
 *
 * Barely a gradient at all — six values of lift from top to bottom, just enough
 * that 1030px of flat colour does not read as a dead rectangle.
 */
const COLUMN_BASE = "rgba(9, 11, 17, 0.95)"
export const COLUMN_GRADIENT = `linear-gradient(to bottom, ${COLUMN_SURFACE} 0%, ${COLUMN_BASE} 100%)`

/**
 * The scene behind everything, on the diagonal.
 *
 * Starts at exactly COLUMN_SURFACE in the top-left corner, so the hunt column
 * has no edge against it up there, and lifts towards the bottom-right. The
 * first stop is held to 18% rather than starting to lift immediately, which
 * keeps the whole top-left quadrant — the part the hunt column sits in — at the
 * column's own tone instead of drifting off it within the first few hundred
 * pixels.
 */
const SCENE_FAR = "rgba(33, 40, 56, 0.95)"
export const SCENE_GRADIENT =
  `linear-gradient(to bottom right, ${COLUMN_SURFACE} 0%, ${COLUMN_SURFACE} 18%, ${SCENE_FAR} 100%)`

/**
 * The moving part: three big, heavily blurred colour fields drifting over the
 * gradient, in the site's own accents.
 *
 * Translate only — no scale, no opacity keyframes, nothing that touches a
 * colour. A translated layer is handed to the compositor once and moved; add a
 * scale and the 60px blur has to be re-rasterised every frame, on the machine
 * that is also encoding the stream.
 *
 * All three sit right-of-centre and low, because the top-left corner is meant
 * to stay the flat column tone.
 */
export const SCENE_ORBS = [
  { color: ACCENTS.blue, size: 760, left: 1180, top: 560, opacity: 0.1, duration: "37s" },
  { color: ACCENTS.purple, size: 640, left: 1480, top: 40, opacity: 0.07, duration: "29s" },
  { color: ACCENTS.green, size: 600, left: 620, top: 720, opacity: 0.05, duration: "43s" },
] as const

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
