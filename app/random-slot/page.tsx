"use client"

import { useEffect } from "react"
import { Dices } from "lucide-react"
import { OBS, OBS_RADIUS, shellBackground } from "@/lib/obs-theme"
import { RandomSlotCard, useRandomSpin } from "@/components/obs/random-slot-spinner"
import { EventCard } from "@/components/obs/stream-event-feed"

/**
 * The random slot as its own OBS browser source.
 *
 * The same reel the stream column shows (components/obs/random-slot-spinner),
 * for a scene that wants it somewhere else. Between spins it shows a quiet
 * "ready" card rather than nothing, so the source can be positioned. Spins are
 * started from /admin/random.
 *
 * It used to read random_slot_state, which the admin page never wrote to, so
 * it only ever said "Ready".
 */
export default function RandomSlotSource() {
  const spin = useRandomSpin()

  // A browser source composites over the stream; the page must not paint a background.
  useEffect(() => {
    document.body.style.background = "transparent"
  }, [])

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent p-3">
      <div className="w-[320px] p-2" style={{ backgroundColor: shellBackground(true), borderRadius: OBS_RADIUS.shell }}>
        {spin ? (
          <RandomSlotCard spin={spin} />
        ) : (
          <EventCard icon={<Dices className="h-5 w-5" style={{ color: OBS.random }} />} label="RANDOM SLOT" labelColor={OBS.random}>
            <div className="text-[16px] font-extrabold leading-tight" style={{ color: OBS.value }}>
              Ready
            </div>
            <div className="text-[11px] leading-snug" style={{ color: OBS.muted }}>
              Waiting for the next spin
            </div>
          </EventCard>
        )}
      </div>
    </div>
  )
}
