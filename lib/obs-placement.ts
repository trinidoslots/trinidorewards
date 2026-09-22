import type { CSSProperties } from "react"

/**
 * Where a bar sits inside its OBS browser source.
 *
 * Shared by every full-width strip, because the alternative is each one
 * re-deriving the same two traps: that 0 is a real coordinate, and that the
 * entrance animation ends on `transform: none` and will quietly undo a
 * translate used for centring.
 *
 * The point of placing a bar inside its source at all is sharpness. A source
 * rendered at 960 wide and stretched to 1920 on the canvas is drawing 960
 * pixels of text and asking OBS to invent the rest. Set the source to the whole
 * canvas, place the bar with these, and nothing is ever scaled.
 */

/**
 * A pixel value from the query string.
 *
 * Returns null when absent, blank or unreadable, so 0 stays usable: ?y=0 means
 * the top edge, not "unset". `Number(x) || fallback` gets this wrong, which is
 * the same bug ?hunt=0 hit on the combined overlay.
 */
export function readPx(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export type PlacementParams = {
  get: (name: string) => string | null
}

/**
 * Builds the absolute-position style for a bar.
 *
 * ?x ?y ?w are exact; ?align=top|middle|bottom is the shorthand. ?y wins over
 * ?align when both are given. With none of them the bar fills the source from
 * the top left.
 *
 * `--h` is the bar's own height, which the caller sets.
 */
export function placementFrom(params: PlacementParams): CSSProperties {
  const x = readPx(params.get("x"))
  const y = readPx(params.get("y"))
  const width = readPx(params.get("w"))
  const align = params.get("align")

  const placement: CSSProperties = {
    left: x ?? 0,
    width: width ?? undefined,
    // Stretch to the source's width only when neither edge was pinned.
    right: width === null && x === null ? 0 : undefined,
  }

  if (y !== null) placement.top = y
  // Centred by arithmetic rather than translateY(-50%): the entrance animation
  // ends on `transform: none`, which wins over an inline transform and drops
  // the bar half its own height too low.
  else if (align === "middle") placement.top = "calc(50% - var(--h) / 2)"
  else if (align === "bottom") placement.bottom = 0
  else placement.top = 0

  return placement
}

/** ?h=40 pins the bar's height; otherwise it fills the source up to `max`. */
export function barHeight(params: PlacementParams, max: number): string {
  const pinned = readPx(params.get("h"))
  return pinned !== null && pinned > 0 ? `${pinned}px` : `min(100vh, ${max}px)`
}
