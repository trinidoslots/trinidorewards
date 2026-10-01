"use client"

import { useEffect, useState } from "react"
import { getTimeRemaining } from "@/lib/raffle-utils"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { Clock } from "@/components/landing/parts"

/**
 * Time left on a raffle, in one of two sizes.
 *
 * `inline` is one line for a card's stub; `tiles` is the four-tile clock the
 * landing page and every page header use, for the places the countdown is
 * the point.
 *
 * Starts empty and fills in on mount. The list page is rendered on the server
 * and cached for 30 seconds, so a time computed there was already wrong by
 * the time it reached the browser — and disagreed with the first client
 * render, which is a hydration mismatch.
 */
export function RaffleCountdown({
  endDate,
  variant = "inline",
  accent = ACCENTS.green,
}: {
  endDate: string
  variant?: "inline" | "tiles"
  accent?: string
}) {
  const [left, setLeft] = useState<ReturnType<typeof getTimeRemaining> | null>(null)

  useEffect(() => {
    const tick = () => setLeft(getTimeRemaining(endDate))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [endDate])

  if (variant === "tiles") {
    const value = left ?? { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false }
    return (
      <div>
        <MonoLabel className="mb-3 block text-white/45">{value.expired ? "Closed" : "Draws in"}</MonoLabel>
        <Clock left={{ ...value, over: value.expired }} accent={accent} />
      </div>
    )
  }

  if (left?.expired) {
    return <MonoLabel className="text-white/40">Closed · drawing</MonoLabel>
  }

  return (
    <span className="flex items-baseline gap-2">
      <MonoLabel className="text-white/40">Draws in</MonoLabel>
      <span className="font-mono text-[13px] font-semibold tabular-nums text-white">
        {left
          ? `${left.days > 0 ? `${left.days}d ` : ""}${left.days > 0 || left.hours > 0 ? `${left.hours}h ` : ""}${left.minutes}m ${String(left.seconds).padStart(2, "0")}s`
          : "—"}
      </span>
    </span>
  )
}
