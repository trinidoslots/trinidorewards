/**
 * The card artwork that ships with the site, for the admin's image picker.
 *
 * A written-out list rather than a directory read. The extension download route
 * is the cautionary tale: it does a readdir at request time, which Next's file
 * tracer cannot see, so the folder it needs was never bundled. A list in source
 * is bundled because it *is* source.
 *
 * Adding artwork: drop the file in public/store/<group>/ and add it here.
 */

export type StoreImage = { path: string; label: string }
export type StoreImageGroup = { id: string; label: string; images: StoreImage[] }

const AMOUNTS = [5, 10, 15, 20, 25, 30, 40, 50]

const cards = (folder: string, prefix: string): StoreImage[] =>
  AMOUNTS.map((amount) => ({
    path: `/store/${folder}/${prefix}-${amount}.png`,
    label: `$${amount}`,
  }))

export const STORE_IMAGE_GROUPS: StoreImageGroup[] = [
  { id: "gift-cards", label: "Gift cards", images: cards("gift-cards", "gift-card") },
  { id: "crypto-cards", label: "Crypto cards", images: cards("crypto-cards", "crypto-card") },
]

export const STORE_IMAGES: StoreImage[] = STORE_IMAGE_GROUPS.flatMap((group) => group.images)

/** Whether a stored icon is one of ours, so the picker can show it as selected. */
export function isBundledImage(icon: string | null | undefined): boolean {
  return !!icon && STORE_IMAGES.some((image) => image.path === icon)
}
