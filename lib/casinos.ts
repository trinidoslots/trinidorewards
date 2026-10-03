/**
 * The casinos the OBS frame can dress up as, by id.
 *
 * Plain data, no React, so server code can check an id from the URL. The
 * look of each one lives in components/obs/casino-themes.tsx, which is a
 * client module.
 */

export const CASINO_IDS = ["stake", "gamba", "gamdom", "roobet", "shuffle", "csgo500"] as const

export type CasinoId = (typeof CASINO_IDS)[number]

export const CASINO_NAMES: Record<CasinoId, string> = {
  stake: "Stake",
  gamba: "Gamba",
  gamdom: "Gamdom",
  roobet: "Roobet",
  shuffle: "Shuffle",
  csgo500: "CSGO500",
}

export function isCasinoId(value: string | null | undefined): value is CasinoId {
  return !!value && (CASINO_IDS as readonly string[]).includes(value)
}
