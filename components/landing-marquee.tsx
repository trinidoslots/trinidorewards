"use client"

import { Trophy } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

/**
 * A strip of recent winners, scrolling.
 *
 * Real rows out of the winner log, because the point of it is that these are
 * people who actually got paid — a made-up ticker is worse than none. It
 * renders nothing when the log is empty rather than inventing filler.
 *
 * The track is duplicated and the pair translated by exactly half its own
 * width, so the second copy is sitting where the first started at the moment
 * the loop resets and there is no seam. Duration scales with the number of
 * items so a short list does not race past.
 */

export type MarqueeWin = { id: string; username: string; prize: string; accent: string }

export function WinnersMarquee({ wins }: { wins: MarqueeWin[] }) {
  if (wins.length === 0) return null

  // Roughly four seconds per item, with a floor so two winners still drift.
  const duration = Math.max(18, wins.length * 4)
  const track = [...wins, ...wins]

  return (
    <div className="marquee marquee-mask relative overflow-hidden border-y border-white/[0.06] bg-white/[0.015] py-3">
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
        {track.map((win, index) => (
          <div
            key={`${win.id}-${index}`}
            className="flex shrink-0 items-center gap-2.5 px-6"
            // The duplicate half is decoration; a screen reader should hear the
            // list once.
            aria-hidden={index >= wins.length}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: win.accent }} />
            <span className="whitespace-nowrap text-[13px] font-medium text-white/80">{win.username}</span>
            <span className="whitespace-nowrap text-[13px] tabular-nums" style={{ color: win.accent }}>
              {win.prize}
            </span>
            <span className="h-3 w-px bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The label that sits above the strip. */
export function MarqueeHeading() {
  return (
    <div className="flex items-center justify-center gap-2.5 pb-3 pt-10">
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: ACCENTS.green }} />
      <MonoLabel className="text-white/30">Recently paid out</MonoLabel>
    </div>
  )
}
