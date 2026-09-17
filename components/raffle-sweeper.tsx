"use client"

import { useEffect } from "react"

/**
 * Nudges automatic raffles along.
 *
 * The hosting plan allows one cron a day, which is far too slow for a raffle
 * people are waiting on, so anybody loading the raffles page moves it forward
 * instead. It fires once per mount, ignores the answer and renders nothing —
 * the draw it triggers shows up on the next load.
 */
export function RaffleSweeper() {
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/raffles/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due: true }),
      signal: controller.signal,
    }).catch(() => {
      // A failed sweep is not the visitor's problem; the cron is the backstop.
    })
    return () => controller.abort()
  }, [])

  return null
}
