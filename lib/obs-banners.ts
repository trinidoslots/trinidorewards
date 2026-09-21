// Banners rotating through the OBS stream widget's event column.
//
// `src` is either an absolute URL or a path under `public/` for anything kept
// in the repo. Order here is the rotation order; adding or removing a line is
// the only change needed.

export type ObsBanner = {
  src: string
  /** Shown to screen readers and used as the title when the image fails to load. */
  alt: string
}

// Ordered so the site's own pages come round first, then the affiliate codes,
// then the socials, with the responsible-gambling card last. At
// BANNER_ROTATION_MS each that is a two-minute cycle.
export const OBS_BANNERS: ObsBanner[] = [
  { src: "/banners/trinido-rewards.png", alt: "Trinido Rewards" },
  { src: "/banners/leaderboards.png", alt: "Leaderboards" },
  { src: "/banners/raffles.png", alt: "Raffles" },
  { src: "/banners/tournaments.png", alt: "Tournaments" },
  { src: "/banners/store.png", alt: "Store" },
  { src: "/banners/stake-com.png", alt: "Stake.com — use code Trinido" },
  { src: "/banners/stake-eu.png", alt: "Stake.eu — use code Trinido" },
  { src: "/banners/stake-us.png", alt: "Stake.us — use code Trinido" },
  { src: "/banners/discord.png", alt: "Discord" },
  { src: "/banners/x-trinidorewards.png", alt: "Follow @TrinidoRewards on X" },
  { src: "/banners/x-trinidoslots.png", alt: "Follow @TrinidoSlots on X" },
  { src: "/banners/responsible-gambling.png", alt: "Know your limits — BeGambleAware.org" },
]

/**
 * How long each banner stays on screen. Matches the 10s cadence of the standalone
 * EarnLab slider (Documents/OBS-TrinidoSlots/EarnLab_bilder.html) so the two
 * read as the same rotation.
 */
export const BANNER_ROTATION_MS = 10_000

/**
 * Native proportions of the artwork (1600x1000). The slot is sized to this, so
 * correctly-cut artwork fills it exactly and anything else is letterboxed
 * rather than cropped through the middle of a wordmark.
 *
 * Changing this changes how much of the column the banner takes: in a 360px
 * column, 8:5 is a 225px-tall slot.
 */
export const BANNER_ASPECT_RATIO = "1600 / 1000"
