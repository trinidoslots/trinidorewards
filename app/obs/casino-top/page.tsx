"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { barHeight, placementFrom } from "@/lib/obs-placement"
import { CasinoTopStrip } from "@/components/obs/casino-strips"
import { CasinoThemeProvider, casinoTheme } from "@/components/obs/casino-themes"

/**
 * The strip that sits above the game capture, on its own.
 *
 * Use /obs/casino-frame instead when you want both strips and the rails as one
 * source. This one is for placing it separately.
 *
 * Takes the same ?x ?y ?w ?h ?align as /obs/now-playing, and ?casino=gamba
 * (or gamdom, roobet, shuffle, csgo500) for another casino's look. Stake
 * without it.
 */

const MAX_BAR_PX = 140

function CasinoTop() {
  const params = useSearchParams()

  return (
    <CasinoThemeProvider theme={casinoTheme(params.get("casino"))}>
      <div
        className="relative h-screen w-full bg-transparent"
        style={{ ["--h" as string]: barHeight(params, MAX_BAR_PX) }}
      >
        <CasinoTopStrip style={placementFrom(params)} />
      </div>
    </CasinoThemeProvider>
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
