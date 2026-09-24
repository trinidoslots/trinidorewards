"use client"

import { useEffect, useRef } from "react"
import { playPing, type PingKind } from "@/lib/obs-ping"

/**
 * How long after mount before a transition is allowed to make a sound.
 *
 * The giveaway, prediction and tournament cards are driven by *state*, not by
 * an event stream: the overlay asks "is one running?" and gets an answer. So
 * the first answer always looks like a transition from nothing to something,
 * and without this an OBS source that reloads mid-giveaway would announce it
 * again — the same trap the transaction feed avoids by not pinging its own
 * backfill.
 *
 * Long enough for the initial fetch in each of those hooks to have landed,
 * short enough that starting a giveaway right after a reload is still heard.
 * The cost of being wrong in one direction is a stray beep on every reload; in
 * the other, one missed beep in the first three seconds.
 */
const ARM_DELAY_MS = 3000

/**
 * Plays a ping when something goes from not-running to running.
 *
 * Deliberately driven by the same flag that decides whether the card is on
 * screen, rather than by a subscription of its own: the sound then cannot
 * disagree with the picture, and it needs no separate guess about what each
 * admin button writes to the database.
 */
export function usePingOnStart(active: boolean, kind: PingKind, volume: number): void {
  const previous = useRef<boolean | null>(null)
  const armed = useRef(false)
  // Read through a ref so a volume change cannot re-run the transition check.
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  useEffect(() => {
    const timer = setTimeout(() => {
      armed.current = true
    }, ARM_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const was = previous.current
    previous.current = active

    // Still settling: record what is there, but stay quiet about it.
    if (!armed.current) return
    // Only the edge into "running" is an event. Everything else — the first
    // reading, staying on, going off — is not.
    if (!active || was === true) return

    playPing(volumeRef.current, kind)
  }, [active, kind])
}
