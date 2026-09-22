"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { barHeight, placementFrom } from "@/lib/obs-placement"
import { CasinoTopStrip } from "@/components/obs/casino-strips"

/**
 * The strip that sits above the game capture, on its own.
 *
 * Use /obs/casino-frame instead when you want both strips and the rails as one
 * source. This one is for placing it separately.
 *
 * Takes the same ?x ?y ?w ?h ?align as /obs/now-playing.
 */

const MAX_BAR_PX = 140

function CasinoTop() {
  const params = useSearchParams()

  return (
    <div
      className="relative h-screen w-full bg-transparent"
      style={{ ["--h" as string]: barHeight(params, MAX_BAR_PX) }}
    >
      <CasinoTopStrip style={placementFrom(params)} />
    </div>
  )
}

export default function CasinoTopPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <CasinoTop />
    </Suspense>
  )
}
