"use client"

import { useEffect, useRef, useState } from "react"
import { Trophy } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

/**
 * The roll, made visible.
 *
 * Cycles entrant names fast, then slows to a stop on the winner. Purely
 * theatre — the winner is already decided on the server before this starts, so
 * nothing here can change who wins. It exists because a draw that resolves in
 * 200ms with no animation is impossible to show on stream.
 *
 * Names are cycled weighted by tickets, so someone holding half the tickets
 * flashes past about half the time and the spin looks like the odds are.
 */

const SPIN_MS = 2600
/** Fast at the start, crawling at the end. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function RaffleDrawSpinner({
  names,
  winner,
  onDone,
}: {
  /** One entry per ticket, so the cycle reflects the odds. */
  names: string[]
  /** Null while the server is still deciding — the spinner keeps going. */
  winner: string | null
  onDone?: () => void
}) {
  const [shown, setShown] = useState(names[0] ?? "…")
  const [landed, setLanded] = useState(false)
  const startedAt = useRef<number | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (names.length === 0) return
    startedAt.current = performance.now()

    const tick = (now: number) => {
      const elapsed = now - (startedAt.current ?? now)
      const progress = Math.min(1, elapsed / SPIN_MS)

      // Only settle once the server has actually answered; if it is slow the
      // wheel keeps turning rather than landing on a guess.
      if (progress >= 1 && winner) {
        setShown(winner)
        setLanded(true)
        onDone?.()
        return
      }

      // Gaps widen as it slows: 25ms at the start, ~320ms at the end.
      const gap = 25 + easeOut(Math.min(progress, 0.999)) * 300
      const index = Math.floor(elapsed / gap) % names.length
      setShown(names[index] ?? "…")

      frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [names, winner, onDone])

  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border px-6 py-8 transition-colors duration-500"
      style={{
        borderColor: landed ? `${ACCENTS.amber}55` : "rgba(255,255,255,0.08)",
        backgroundColor: landed ? `${ACCENTS.amber}0f` : "rgba(255,255,255,0.02)",
      }}
    >
      {landed ? (
        <Trophy className="h-6 w-6" style={{ color: ACCENTS.amber }} />
      ) : (
        <MonoLabel className="text-white/25">Drawing</MonoLabel>
      )}

      <p
        className="max-w-full truncate text-center text-[26px] font-bold leading-tight tabular-nums transition-transform duration-200"
        style={{
          color: landed ? ACCENTS.amber : "#E7E7EA",
          transform: landed ? "scale(1.06)" : "scale(1)",
        }}
      >
        {shown}
      </p>

      {landed && <MonoLabel style={{ color: ACCENTS.amber }}>Winner</MonoLabel>}
    </div>
  )
}

/**
 * One name per ticket held, capped so a raffle with tens of thousands of
 * tickets does not build a giant array just to flash names past.
 */
export function weightedNames(
  entries: { username: string; tickets_purchased: number }[],
  cap = 400,
): string[] {
  const total = entries.reduce((sum, entry) => sum + (Number(entry.tickets_purchased) || 0), 0)
  if (total === 0) return entries.map((entry) => entry.username)

  const scale = total > cap ? cap / total : 1
  const names: string[] = []

  for (const entry of entries) {
    // At least one appearance each: everybody in the raffle should flash past
    // at least once, however few tickets they hold.
    const slots = Math.max(1, Math.round((Number(entry.tickets_purchased) || 0) * scale))
    for (let index = 0; index < slots; index++) names.push(entry.username)
  }

  // Interleaved rather than grouped, so it does not spin through one name
  // twenty times in a row.
  for (let index = names.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[names[index], names[swap]] = [names[swap], names[index]]
  }
  return names
}
