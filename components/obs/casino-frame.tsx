"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { isPlaying } from "@/lib/now-playing"
import { readPx } from "@/lib/obs-placement"
import { CasinoTopStrip, NowPlayingStrip, PREVIEW_ROW, useNowPlaying } from "@/components/obs/casino-strips"
import { CASINOS, CasinoThemeProvider } from "@/components/obs/casino-themes"
import type { CasinoId } from "@/lib/casinos"

/**
 * Both strips as one piece: a frame for the game capture.
 *
 * One frame per casino, all the same shape: /obs/casino-frame is Stake, and
 * /obs/casino-frame/<id> is any of the others (gamba, gamdom, roobet,
 * shuffle, csgo500 — or stake again). Only the tones, logo, icons and the
 * Fun/Real control differ, and those live in casino-themes.tsx.
 *
 * Top strip, bottom strip, and a rail down each side joining them, all in the
 * same tone, with the middle left transparent so the capture shows through.
 * The outer corners are rounded and the whole thing is clipped to that radius —
 * which is why the strips need no radius of their own. Rounding them
 * separately would need the top strip to round only its top corners and the
 * bottom only its bottom, and the two would drift apart the first time one was
 * touched.
 *
 * The frame fills its browser source. Set the source in OBS to the size the
 * frame should have on the canvas (Properties: Width, Height) and leave its
 * transform at 100% (right-click, Transform, Reset Transform). Dragging the
 * box bigger instead makes OBS stretch 1410 pixels of text over 1498 and the
 * strips go soft; that is what the old fixed 1410x850 default invited.
 *
 *   ?w ?h        pin the frame to a size inside the source (default: all of it)
 *   ?top ?bottom strip heights, default 50 and 40
 *   ?rail        side rail width, default 4
 *   ?radius      corner radius, default 12
 *   ?preview=1   a sample game without touching what is saved
 *   ?art=1       the game's thumbnail in the bottom strip
 */

const DEFAULTS = {
  /**
   * The top strip is the taller of the two because it carries more: a logo,
   * the wallet group and four icons, against a single line of text below.
   */
  top: 50,
  bottom: 40,
  rail: 4,
  radius: 12,
  /**
   * The hairline around the outside. ?outline=0 turns it off.
   *
   * A ring laid over everything else, not a border on the frame. box-sizing
   * is border-box, so it takes its width from the frame's own pixels rather
   * than adding to them — the source stays exactly ?w by ?h.
   */
  outline: 1,
} as const

function CasinoFrame({ casino }: { casino: CasinoId }) {
  const params = useSearchParams()
  const theme = CASINOS[casino]
  /** Top strip's tone at the top of the rail, bottom strip's at the bottom. */
  const railFade = `linear-gradient(to bottom, ${theme.colors.topBackground}, ${theme.colors.background})`
  const isPreview = params.get("preview") === "1"

  const live = useNowPlaying(!isPreview)
  const row = isPreview ? PREVIEW_ROW : live

  const width = readPx(params.get("w")) ?? "100vw"
  const height = readPx(params.get("h")) ?? "100vh"
  const top = readPx(params.get("top")) ?? DEFAULTS.top
  const bottom = readPx(params.get("bottom")) ?? DEFAULTS.bottom
  const rail = readPx(params.get("rail")) ?? DEFAULTS.rail
  const radius = readPx(params.get("radius")) ?? DEFAULTS.radius
  const outline = readPx(params.get("outline")) ?? DEFAULTS.outline

  const showArt = params.get("art") === "1"

  return (
    <CasinoThemeProvider theme={theme}>
      <div className="h-screen w-full bg-transparent">
        <div
          // Fixed to the viewport rather than sitting in the document flow. In
          // flow it started 6px down: app/template.tsx wrapped every route in a
          // motion.div with a transform, and a transform is the containing block
          // for position: fixed, so the frame was measured from there instead of
          // the viewport. That wrapper no longer covers the OBS routes, but fixed
          // is still the right answer — nothing before it in the DOM can move it.
          // No radius and no border on this box — it is a plain rectangle that
          // only clips. Both used to be here, and the corners paid for it: a
          // rounded `overflow: hidden` clips the strips along a curve, and a
          // browser antialiases a clip edge differently from an edge it draws,
          // so the drawn border and the clipped fill disagreed by a fraction of
          // a pixel all the way round each arc. Over a capture that reads as
          // grubby corners.
          //
          // The corners are shapes now instead of cuts: each strip rounds its
          // own two outer corners, and the outline is a ring laid over them at
          // the same radius. Same rasteriser, same path, nothing to disagree
          // with. The clip stays, but as a rectangle it never reaches a corner.
          className="fixed left-0 top-0 overflow-hidden"
          style={{ width, height }}
        >
          {/*
          The rails run between the two strips, not down the whole frame, and
          they are elements rather than a border on the frame.

          As a border they sat outside the strips, so the top strip — which is
          a shade darker than the rest — would have had a lighter 4px stub down
          each side and the frame's top corners would have been drawn in the
          lighter tone. Two strips spanning the full width, with the rails only
          alongside the capture, has no such seam.

          Each rail then fades from the top strip's tone to the bottom strip's
          over its own length. Held at one colour it met the darker strip in a
          hard step at the top; now both ends match what they touch and the
          change happens across 760px, where no edge can show.
        */}
          <div
            aria-hidden
            className="absolute left-0"
            style={{ top, bottom, width: rail, backgroundImage: railFade }}
          />
          <div
            aria-hidden
            className="absolute right-0"
            style={{ top, bottom, width: rail, backgroundImage: railFade }}
          />

          {/* Each strip carries its own --h, and every size inside it is a
            fraction of that number, so the two keep their shape at any
            height. ?top and ?bottom change them independently. */}
          <div style={{ ["--h" as string]: `${top}px` }}>
            <CasinoTopStrip style={{ top: 0, left: 0, right: 0, borderRadius: `${radius}px ${radius}px 0 0` }} />
          </div>

          {isPlaying(row) && (
            <div style={{ ["--h" as string]: `${bottom}px` }}>
              <NowPlayingStrip
                row={row}
                showArt={showArt}
                style={{ bottom: 0, left: 0, right: 0, borderRadius: `0 0 ${radius}px ${radius}px` }}
              />
            </div>
          )}

          {/* Last, so it is drawn over the strips' own antialiased corners
            rather than beside them. Same radius, so the two arcs are the same
            arc and the ring simply sits on top of it. */}
          {outline > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ border: `${outline}px solid ${theme.colors.outline}`, borderRadius: radius }}
            />
          )}
        </div>
      </div>
    </CasinoThemeProvider>
  )
}

export function CasinoFramePage({ casino }: { casino: CasinoId }) {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <CasinoFrame casino={casino} />
    </Suspense>
  )
}
