/**
 * The raffle and tournament artwork that ships with the site.
 *
 * Written out rather than read from the directory, for the same reason
 * lib/store-images.ts is: the extension download route does a readdir at request
 * time, Next's file tracer cannot see that, and the folder it needed was never
 * bundled. A list in source is bundled because it *is* source.
 *
 * Adding artwork: drop the file in public/raffles/ or public/tournaments/ and
 * add a line here.
 *
 * Deliberately separate from lib/store-images.ts rather than merged into it.
 * The two lists have the same shape but different owners, and the store picker
 * is wired into forms that work; a shared module would have meant editing them
 * to add artwork somewhere else.
 */

export type CardImage = { path: string; label: string }
export type CardImageGroup = { id: string; label: string; images: CardImage[] }

/** All 1600x1000, i.e. 8:5 — the same as the store cards, so they frame alike. */
export const CARD_ASPECT = "aspect-[8/5]"

export const RAFFLE_IMAGE_GROUPS: CardImageGroup[] = [
  {
    id: "raffle-cards",
    label: "Raffle cards",
    images: [
      { path: "/raffles/daily-raffle.png", label: "Daily" },
      { path: "/raffles/weekly-raffle.png", label: "Weekly" },
      { path: "/raffles/speed-raffle.png", label: "Speed" },
      { path: "/raffles/stream-raffle.png", label: "Stream" },
    ],
  },
]

export const TOURNAMENT_IMAGE_GROUPS: CardImageGroup[] = [
  {
    id: "tournament-cards",
    label: "Tournament cards",
    images: [
      { path: "/tournaments/bonus-buy-battle.png", label: "Bonus Buy Battle" },
      { path: "/tournaments/tournament.png", label: "Tournament" },
    ],
  },
]

/** What a bonus battle gets when the panel creates one. */
export const DEFAULT_BATTLE_IMAGE = "/tournaments/bonus-buy-battle.png"

/** Whether a stored path is one of ours, so the picker can show it selected. */
export function isBundledCard(groups: CardImageGroup[], value: string | null | undefined): boolean {
  return !!value && groups.some((group) => group.images.some((image) => image.path === value))
}
