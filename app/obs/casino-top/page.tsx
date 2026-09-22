"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { barHeight, placementFrom } from "@/lib/obs-placement"

/**
 * The strip that sits above the game capture, matching the bar below it.
 *
 * Purely decoration: the logo and four icons, no data and no subscriptions. It
 * exists so the capture in the middle of the scene is framed top and bottom in
 * the same tone instead of having a bare edge at the top.
 *
 * The icons are the casino's own, copied path-for-path out of the markup rather
 * than redrawn — a hand-traced bell next to a real one is the kind of near-miss
 * that looks like a mistake. Each is a 20x20 viewBox filled with currentColor.
 *
 * Takes the same ?x ?y ?w ?h ?align as /obs/now-playing, so both strips can be
 * placed inside one full-canvas source and neither is ever scaled.
 */

/** Matches the now-playing bar, which is the point. */
const BACKGROUND = "#203744"
const ICON = "#94ACB8"

const MAX_BAR_PX = 140

/** A fraction of the bar's height, as a CSS length. */
const u = (fraction: number) => `calc(var(--h) * ${fraction})`

const ICONS: { name: string; path: string }[] = [
  {
    name: "Search",
    path: "m18.93 17.74-4.02-4.01a7.91 7.91 0 1 0-1.18 1.18l4.01 4q.26.25.6.25t.59-.24a.83.83 0 0 0 0-1.18M2.5 8.75a6.25 6.25 0 1 1 12.5 0 6.25 6.25 0 0 1-12.5 0",
  },
  {
    name: "Account",
    path: "M10 9.17a4.17 4.17 0 1 0 0-8.34 4.17 4.17 0 0 0 0 8.34m-2.5 1.66h5a6.66 6.66 0 0 1 6.67 6.67c0 .92-.75 1.67-1.67 1.67h-15c-.92 0-1.67-.75-1.67-1.67a6.66 6.66 0 0 1 6.67-6.67",
  },
  {
    name: "Notifications",
    path: "M16.3 11.85V7.3a6.3 6.3 0 1 0-12.6 0v4.55a2.25 2.25 0 0 0 .45 4.45h11.7a2.25 2.25 0 0 0 .45-4.45M10 19a3.6 3.6 0 0 0 3.1-1.8H6.9A3.6 3.6 0 0 0 10 19",
  },
  {
    name: "Sidebar",
    path: "M17.5.83h-15C1.58.83.83 1.58.83 2.5v15c0 .92.75 1.67 1.67 1.67h15c.92 0 1.67-.75 1.67-1.67v-15c0-.92-.75-1.67-1.67-1.67m-6.67 15.65c0 .56-.46 1.02-1.01 1.02h-6.3c-.56 0-1.02-.46-1.02-1.02V3.52c0-.56.46-1.02 1.02-1.02h6.3c.55 0 1.01.46 1.01 1.02z",
  },
]

function Icon({ name, path }: { name: string; path: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      role="img"
      aria-label={name}
      style={{ width: u(0.42), height: u(0.42), display: "block", flexShrink: 0 }}
    >
      <path fill={ICON} d={path} />
    </svg>
  )
}

function CasinoTop() {
  const params = useSearchParams()
  const placement = placementFrom(params)
  const height = barHeight(params, MAX_BAR_PX)

  return (
    <div className="relative h-screen w-full bg-transparent" style={{ ["--h" as string]: height }}>
      <div
        className="absolute flex items-center overflow-hidden"
        style={{
          ...placement,
          height: "var(--h)",
          backgroundColor: BACKGROUND,
          padding: `0 ${u(0.34)}`,
        }}
      >
        {/*
          The logo is a 2:1 white-on-transparent PNG, so it only needs a height
          and object-contain keeps it honest if that ever stops being 2:1.
        */}
        <img
          src="/stake-logo-white.png"
          alt="Stake"
          className="shrink-0 object-contain"
          style={{ height: u(0.4) }}
        />

        <span className="ml-auto flex shrink-0 items-center" style={{ gap: u(0.46) }}>
          {ICONS.map((icon) => (
            <Icon key={icon.name} {...icon} />
          ))}
        </span>
      </div>
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
