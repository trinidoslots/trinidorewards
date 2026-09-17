"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

/**
 * The roll, as a reel — the same idea as the giveaway widget: a strip of names
 * scrolling past a fixed centre marker, decelerating onto the winner.
 *
 * The first version cycled a single line of text, which read as a label
 * flickering rather than a wheel spinning. It also had a bug that stopped it
 * cycling at all: the effect listed `onDone` in its dependencies, every caller
 * passed an inline arrow, so the effect re-ran on each render and reset the
 * clock before any time could pass. onDone is held in a ref now.
 *
 * Purely theatre. The winner is decided on the server before this mounts;
 * nothing here can change who wins.
 */

const CELL_WIDTH = 132
const CELL_GAP = 6
const STRIP_LENGTH = 48
/** Far enough in that the strip is still moving fast well past the halfway point. */
const WINNER_INDEX = 40
const HOLD_MS = 600

export function RaffleDrawReel({
  pool,
  winner,
  durationMs = 5200,
  onDone,
}: {
  /** Names to fill the strip with, repeated by tickets held. */
  pool: string[]
  winner: string
  durationMs?: number
  onDone?: () => void
}) {
  const [offset, setOffset] = useState(0)
  const [landed, setLanded] = useState(false)

  // Held in a ref so a caller passing an inline arrow — which all of them do —
  // cannot restart the roll on every render.
  const done = useRef(onDone)
  done.current = onDone

  // Built once per winner. A parent re-render must not reshuffle the strip
  // mid-scroll, or the names would jump under the marker.
  const strip = useMemo(() => {
    const names = pool.length > 0 ? pool : [winner]
    return Array.from({ length: STRIP_LENGTH }, (_, index) =>
      index === WINNER_INDEX ? winner : names[Math.floor(Math.random() * names.length)],
    )
  }, [winner, pool])

  useEffect(() => {
    setLanded(false)
    setOffset(0)

    // A beat of stillness before it goes, so the start of the movement is
    // visible rather than already underway when you look.
    const start = setTimeout(() => {
      setOffset(-(WINNER_INDEX * (CELL_WIDTH + CELL_GAP)))
    }, HOLD_MS)

    const finish = setTimeout(() => {
      setLanded(true)
      done.current?.()
    }, HOLD_MS + durationMs)

    return () => {
      clearTimeout(start)
      clearTimeout(finish)
    }
  }, [winner, durationMs])

  return (
    <div className="w-full">
      <div className="mb-1.5 flex h-4 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            // Keyed on the label so the two states hand over rather than the
            // text changing underneath you.
            key={landed ? "won" : "rolling"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <MonoLabel style={{ color: landed ? ACCENTS.amber : ACCENTS.blue }}>
              {landed ? "We have a winner" : "Rolling"}
            </MonoLabel>
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="relative h-16 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-black/40">
        {/* The marker the strip lands under. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2"
          style={{
            backgroundColor: landed ? ACCENTS.amber : ACCENTS.blue,
            boxShadow: `0 0 10px 2px ${landed ? ACCENTS.amber : ACCENTS.blue}66`,
          }}
        />

        {/* Edges faded, so names arrive and leave rather than popping in. */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,11,13,1) 0%, rgba(11,11,13,0) 18%, rgba(11,11,13,0) 82%, rgba(11,11,13,1) 100%)",
          }}
        />

        <motion.div
          className="absolute inset-y-0 left-1/2 flex items-center"
          style={{ gap: CELL_GAP, marginLeft: -(CELL_WIDTH / 2) }}
          animate={{ x: offset }}
          // Slow, long tail: most of the distance goes early, the last few
          // names crawl past.
          transition={{ duration: durationMs / 1000, ease: [0.12, 0, 0.12, 1] }}
        >
          {strip.map((name, index) => {
            const isWinner = landed && index === WINNER_INDEX
            return (
              <motion.div
                key={`${name}-${index}`}
                // The landed cell swells slightly as it is picked out, so the
                // stop reads as an arrival rather than the strip just halting.
                animate={{ scale: isWinner ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 340, damping: 18 }}
                className="flex h-12 shrink-0 items-center justify-center rounded-md border px-3 transition-colors duration-300"
                style={{
                  width: CELL_WIDTH,
                  borderColor: isWinner ? `${ACCENTS.amber}88` : "rgba(255,255,255,0.07)",
                  backgroundColor: isWinner ? `${ACCENTS.amber}22` : "rgba(255,255,255,0.03)",
                }}
              >
                <span
                  className="truncate text-[13px] font-semibold"
                  style={{ color: isWinner ? ACCENTS.amber : "#C9C9D2" }}
                >
                  {name}
                </span>
              </motion.div>
            )
          })}
        </motion.div>
      </div>

      {/* Reserved height, so the reel does not jump when the name appears. */}
      <div className="mt-2 flex h-7 items-center justify-center">
        <AnimatePresence>
          {landed && (
            <motion.p
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
              className="max-w-full truncate text-center text-[20px] font-bold leading-tight"
              style={{ color: ACCENTS.amber }}
            >
              {winner}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * One name per ticket held, capped so a raffle with tens of thousands of
 * tickets does not build a giant array just to fill a strip.
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
    // At least one appearance each: everybody in the raffle should go past at
    // least once, however few tickets they hold.
    const slots = Math.max(1, Math.round((Number(entry.tickets_purchased) || 0) * scale))
    for (let index = 0; index < slots; index++) names.push(entry.username)
  }
  return names
}
