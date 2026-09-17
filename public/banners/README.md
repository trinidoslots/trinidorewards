# OBS stream widget banners

Banners rotate in the event column of `/obs/stream`, one every
`BANNER_ROTATION_MS` (10s), in the order listed in `lib/obs-banners.ts`.

A banner is either a remote URL or a file kept here:

```ts
export const OBS_BANNERS: ObsBanner[] = [
  { src: "https://cdn.earnlab.com/banners/Earn.avif", alt: "EarnLab — Earn" },
  { src: "/banners/stake.svg", alt: "Stake.com" },
]
```

The slot is sized to `BANNER_ASPECT_RATIO` (1530x660, matching the EarnLab
artwork). Cut new banners to that ratio and they fill it exactly; anything else
is letterboxed rather than cropped through the middle of a wordmark.

## stake.svg

Built here rather than supplied as artwork, so it is plain SVG you can edit in a
text editor. To put your referral code on it, replace the text in the element
marked `referral slot` — it currently shows the channel name.

Note it carries no official Stake assets: the wordmark is set in a system sans,
not Stake's own typeface. If you have official affiliate artwork, drop it in and
point `lib/obs-banners.ts` at that instead.
