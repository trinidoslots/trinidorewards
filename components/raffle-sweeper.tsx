"use client"

import { useEffect } from "react"

/**
 * Draws automatic raffles the moment they close.
 *
 * Three things move an automatic raffle along, because none of them covers
 * every case on its own:
 *
 *   this timer  — fires at the exact closing second of whichever raffle is next
 *                 up, but only while somebody has the page open;
 *   pg_cron     — every minute inside the database (scripts/051), which needs
 *                 the extension to be available on the plan;
 *   the daily   — the hosting plan's one cron a day, as a last resort.
 *
 * All three call the same endpoint, and the draw is guarded so two of them
 * landing together cannot crown two different winners.
 */
export function RaffleSweeper({ nextCloseAt }: { nextCloseAt?: string | null }) {
  useEffect(() => {
    const controller = new AbortController()

    const sweep = () =>
      fetch("/api/raffles/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due: true }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          // A draw changes what this page shows, so bring it up to date rather
          // than leaving a raffle listed as open after its winner was picked.
          if (data?.drawn?.length > 0) window.location.reload()
        })
        .catch(() => {
          // A failed sweep is not the visitor's problem; the crons are behind it.
        })

    // Anything already overdue when the page opened.
    sweep()

    if (!nextCloseAt) return () => controller.abort()

    const waitFor = Date.parse(nextCloseAt) - Date.now()
    // A couple of seconds past the close, so the server agrees it has ended.
    // setTimeout caps out around 24.8 days; anything further off is left to the
    // crons rather than scheduled and silently fired immediately.
    if (!Number.isFinite(waitFor) || waitFor > 2_000_000_000) return () => controller.abort()

    const timer = setTimeout(sweep, Math.max(0, waitFor) + 2000)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [nextCloseAt])

  return null
}
