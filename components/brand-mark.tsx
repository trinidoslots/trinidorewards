import type { SVGProps } from "react"

/**
 * The TrinidoRewards mark.
 *
 * Taken from the design canvas "TrinidoRewards Logo", where the same four
 * shapes appear in all four artboards: a rounded dark tile, a T built from two
 * bars, and an accent dot at the top right. Copied rather than redrawn — the
 * artboards agree on every coordinate, so there is one right answer and no
 * reason to approximate it.
 *
 * The tile carries its own fill and hairline, so it does not want a wrapper
 * with a border and a background of its own; that was the mascot's frame and
 * it doubles up.
 */

/** The dot. The canvas offers three alternatives; this is its default. */
export const BRAND_ACCENT = "#5B8DEF"

export function BrandMark({ accent = BRAND_ACCENT, ...props }: SVGProps<SVGSVGElement> & { accent?: string }) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <rect x="0.5" y="0.5" width="63" height="63" rx="14" fill="#121216" stroke="rgba(255,255,255,0.14)" />
      <rect x="14" y="18" width="26" height="7" rx="1.5" fill="#FFFFFF" />
      <rect x="23.5" y="18" width="7" height="28" rx="1.5" fill="#FFFFFF" />
      <circle cx="45" cy="21.5" r="4.5" fill={accent} />
    </svg>
  )
}
