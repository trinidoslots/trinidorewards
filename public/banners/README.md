# OBS stream widget banners

Banners rotate in the event column of `/obs/stream`, one every
`BANNER_ROTATION_MS` (10s), in the order listed in `lib/obs-banners.ts`.

A banner is either a remote URL or a file kept here:

```ts
export const OBS_BANNERS: ObsBanner[] = [
  { src: "/banners/leaderboards.png", alt: "Leaderboards" },
  { src: "https://example.com/partner.avif", alt: "A partner banner" },
]
```

## Cutting new artwork

The slot is sized to `BANNER_ASPECT_RATIO` (1600x1000). Cut new banners to that
and they fill it exactly; anything else is letterboxed rather than cropped
through the middle of a wordmark.

**The rotator draws no card of its own** — no background, no border, no corner
radius. The artwork in here supplies all three itself, and a shell behind it put
a second border a few pixels outside the first one. So a new banner has to bring
its own background: a transparent PNG will show the gameplay through it.

## stake.svg

Superseded by `stake-com.png`, `stake-eu.png` and `stake-us.png`, and no longer
in the rotation. Kept because it is plain SVG you can edit in a text editor —
the referral text sits in the element marked `referral slot`.

Note it carries no official Stake assets: the wordmark is set in a system sans,
not Stake's own typeface.
