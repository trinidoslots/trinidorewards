// Banners rotating through the OBS stream widget's event column.
//
// `src` is either an absolute URL (the EarnLab banners live on cdn.earnlab.com)
// or a path under `public/` for anything kept in the repo. Order here is the
// rotation order; adding or removing a line is the only change needed.

export type ObsBanner = {
  src: string
  /** Shown to screen readers and used as the title when the image fails to load. */
  alt: string
}

export const OBS_BANNERS: ObsBanner[] = [
  { src: "https://cdn.earnlab.com/banners/Earn.avif", alt: "EarnLab — Earn" },
  { src: "https://cdn.earnlab.com/banners/Race1.avif", alt: "EarnLab — Race" },
  { src: "https://cdn.earnlab.com/banners/Rewards.avif", alt: "EarnLab — Rewards" },
  { src: "/banners/stake.svg", alt: "Stake.com" },
]

/**
 * How long each banner stays on screen. Matches the 10s cadence of the standalone
 * EarnLab slider (Documents/OBS-TrinidoSlots/EarnLab_bilder.html) so the two
 * read as the same rotation.
 */
export const BANNER_ROTATION_MS = 10_000

/**
 * Native proportions of the EarnLab banners (1530x660). The slot is sized to
 * this, so correctly-cut artwork fills it exactly and anything else is
 * letterboxed rather than cropped through the middle of a wordmark.
 */
export const BANNER_ASPECT_RATIO = "1530 / 660"
