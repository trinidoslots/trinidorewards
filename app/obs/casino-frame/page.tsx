"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { isPlaying } from "@/lib/now-playing"
import { readPx } from "@/lib/obs-placement"
import {
  CasinoTopStrip,
  NowPlayingStrip,
  PREVIEW_ROW,
  STRIP,
  useNowPlaying,
} from "@/components/obs/casino-strips"

/**
 * Both strips as one piece: a frame for the game capture.
 *
 * Top strip, bottom strip, and a rail down each side joining them, all in the
 * same tone, with the middle left transparent so the capture shows through.
 * The outer corners are rounded and the whole thing is clipped to that radius —
 * which is why the strips need no radius of their own. Rounding them
 * separately would need the top strip to round only its top corners and the
 * bottom only its bottom, and the two would drift apart the first time one was
 * touched.
 *
 * Default 1410x900. Set the OBS source to exactly that and place it over the
 * capture; do not resize the box, or the text is drawn at one size and
 * stretched to another.
 *
 *   ?w ?h        the frame, default 1410x900
 *   ?top ?bottom strip heights, both default 30
 *   ?rail        side rail width, default 4
 *   ?radius      corner radius, default 12
 *   ?preview=1   a sample game without touching what is saved
 *   ?art=1       the game's thumbnail in the bottom strip
 */

const DEFAULTS = {
  width: 1410,
  height: 900,
  /**
   * Both strips the same height.
   *
   * The top one was 80, taken from the casino's own header in the reference
   * capture — but that header carries a wallet, a currency picker and a search
   * field, and this one carries a logo and four icons. At 80 it read as a
   * heavy lid on a thin base. Matching the bottom makes the two a frame rather
   * than a header with a caption.
   */
  strip: 30,
  rail: 4,
  radius: 12,
} as const

function CasinoFrame() {
  const params = useSearchParams()
  const isPreview = params.get("preview") === "1"

  const live = useNowPlaying(!isPreview)
  const row = isPreview ? PREVIEW_ROW : live

  const width = readPx(params.get("w")) ?? DEFAULTS.width
  const height = readPx(params.get("h")) ?? DEFAULTS.height
  const top = readPx(params.get("top")) ?? DEFAULTS.strip
  const bottom = readPx(params.get("bottom")) ?? DEFAULTS.strip
  const rail = readPx(params.get("rail")) ?? DEFAULTS.rail
  const radius = readPx(params.get("radius")) ?? DEFAULTS.radius

  const showArt = params.get("art") === "1"

  return (
    <div className="h-screen w-full bg-transparent">
      <div
        // Fixed to the viewport rather than sitting in the document flow. In
        // flow it started 6px down, because dev builds inject elements ahead of
        // it in <body>, and a frame 6px lower than its own source then pushed
        // the document past the viewport and grew a scrollbar, which narrowed
        // it again. Nothing before it in the DOM can move it now.
        className="fixed left-0 top-0 overflow-hidden"
        style={{
          width,
          height,
          borderRadius: radius,
          // Rails only. No top or bottom border — the strips are the top and
          // bottom, and a border there would sit outside them and read as a
          // second, thinner bar.
          borderLeft: `${rail}px solid ${STRIP.background}`,
          borderRight: `${rail}px solid ${STRIP.background}`,
        }}
      >
        {/*
          Each strip still carries its own --h, so ?top and ?bottom can differ
          if you want them to. They just default to the same number.
        */}
        <div style={{ ["--h" as string]: `${top}px` }}>
          <CasinoTopStrip style={{ top: 0, left: 0, right: 0 }} />
        </div>

        {isPlaying(row) && (
          <div style={{ ["--h" as string]: `${bottom}px` }}>
            <NowPlayingStrip row={row} showArt={showArt} style={{ bottom: 0, left: 0, right: 0 }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function CasinoFramePage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <CasinoFrame />
    </Suspense>
  )
}
