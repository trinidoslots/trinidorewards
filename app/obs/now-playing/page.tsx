"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { isPlaying } from "@/lib/now-playing"
import { barHeight, placementFrom } from "@/lib/obs-placement"
import { NowPlayingStrip, PREVIEW_ROW, useNowPlaying } from "@/components/obs/casino-strips"

/**
 * The slot currently being played, as the casino's own info bar, on its own.
 *
 * Use /obs/casino-frame instead when you want this together with the strip
 * above and the side rails as one source. This one is for placing it
 * separately.
 *
 * The strip itself — every colour and size in it, and why — lives in
 * components/obs/casino-strips.tsx.
 *
 *   ?x ?y ?w ?h   place it inside the source
 *   ?align        top | middle | bottom
 *   ?preview=1    a sample game without touching what is saved
 *   ?art=1        the game's thumbnail
 */

/**
 * Ceiling on the strip's height when it is sizing itself off the source.
 *
 * ?h=40 pins it instead, which is half the answer to a blurry overlay: set the
 * OBS source to the exact pixels it occupies on the canvas and never resize the
 * box. A source rendered at 960 wide and stretched to 1920 is drawing 960
 * pixels of text and asking OBS to invent the rest. The other half is ?x/?y/?w,
 * because pinning the height only helps if the source can be the full canvas.
 */
const MAX_BAR_PX = 120

function NowPlaying() {
  const params = useSearchParams()
  const isPreview = params.get("preview") === "1"

  const live = useNowPlaying(!isPreview)
  const row = isPreview ? PREVIEW_ROW : live

  // Nothing playing: nothing drawn. Not an empty bar — a source that cannot
  // disappear has to be toggled by hand every time you leave a game.
  if (!isPlaying(row)) return null

  return (
    <div
      className="relative h-screen w-full bg-transparent"
      style={{ ["--h" as string]: barHeight(params, MAX_BAR_PX) }}
    >
      <NowPlayingStrip row={row} showArt={params.get("art") === "1"} style={placementFrom(params)} />
    </div>
  )
}

export default function NowPlayingObsPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <NowPlaying />
    </Suspense>
  )
}
