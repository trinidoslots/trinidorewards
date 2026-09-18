"use client"

import { ACCENTS } from "@/components/ui/panel"

/**
 * The slow-moving ground the pages sit on: a drifting grid and three coloured
 * orbs, well behind everything and barely there.
 *
 * Fixed and pointer-events-none, so it costs nothing in layout and never
 * intercepts a click. The orbs are heavily blurred large circles rather than
 * images — no asset to load, and the blur is composited once.
 *
 * Kept faint on purpose. Board pages are dense with numbers; background motion
 * that competes with them makes the figures harder to read, which is the one
 * thing this site cannot afford.
 */

const ORBS = [
  { color: ACCENTS.blue, size: 520, top: "-8%", left: "-6%", duration: "21s", opacity: 0.1 },
  { color: ACCENTS.purple, size: 460, top: "38%", left: "72%", duration: "27s", opacity: 0.08 },
  { color: ACCENTS.green, size: 400, top: "78%", left: "12%", duration: "33s", opacity: 0.06 },
]

export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="ambient-grid absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          animation: "grid-scroll 18s linear infinite",
          // Faded out towards the bottom so the grid does not fight the footer.
          maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        }}
      />

      {ORBS.map((orb) => (
        <div
          key={orb.color}
          className="ambient-orb absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            opacity: orb.opacity,
            filter: "blur(60px)",
            animation: `orb-drift ${orb.duration} ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  )
}
