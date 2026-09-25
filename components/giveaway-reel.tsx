"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

/**
 * The giveaway roll: a strip of entrant tiles that runs sideways under a fixed
 * frame in the middle and stops with the winner inside it.
 *
 * One component for both places a roll is shown, the admin's roll dialog and
 * the OBS widget, so the two can never disagree about who is landing.
 *
 * Everything is worked out from wall-clock times rather than from when the
 * component happened to mount: `startAt` is when the strip starts moving and
 * `durationMs` how long it takes. A browser source that reloads mid-roll
 * builds the same end position and joins the motion where it would be, and
 * one that loads after the landing simply shows the winner in the frame.
 */

/** Tiles in the strip. The winner sits at WINNER_INDEX; the rest is filler. */
const STRIP_LENGTH = 64
const WINNER_INDEX = 52
/** The tile in the frame before the strip moves, so it starts full. */
const START_INDEX = 2

/** Slow at the end, as the reference roll: fast start, long settle. */
const EASING = "cubic-bezier(0.12, 0.62, 0.18, 1)"

export type ReelSize = "large" | "compact"

const SIZES: Record<ReelSize, { tile: number; height: number; gap: number; circle: number; name: number }> = {
  // The admin dialog, as in the reference: ~88px tiles, a 40px circle.
  large: { tile: 88, height: 96, gap: 8, circle: 40, name: 11 },
  // The 300x120 OBS card.
  compact: { tile: 50, height: 58, gap: 5, circle: 24, name: 8 },
}

/** A stable colour per name, so a chatter's circle is the same on every tile. */
export function initialColor(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index++) hash = (hash * 31 + name.charCodeAt(index)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 45% 42%)`
}

export function initials(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "")
  return (letters.slice(0, 2) || name.slice(0, 2) || "?").toUpperCase()
}

/** A chatter's picture, or their initials on their colour. */
export function EntrantAvatar({ name, url, size }: { name: string; url: string | null | undefined; size: number }) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Kick's avatar host, unpredictable
      <img
        src={url}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: initialColor(name), fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  )
}

/** A deterministic shuffle source, so the same roll builds the same strip everywhere. */
function seeded(seed: string) {
  let state = 0
  for (let index = 0; index < seed.length; index++) state = (state * 31 + seed.charCodeAt(index)) | 0
  return () => {
    state = (state * 1664525 + 1013904223) | 0
    return ((state >>> 0) % 1_000_000) / 1_000_000
  }
}

export function GiveawayReel({
  entrants,
  winner,
  avatars,
  startAt,
  durationMs,
  size = "large",
  onLanded,
}: {
  /** Who can come up. The winner is placed whether or not they are in here. */
  entrants: string[]
  winner: string
  avatars?: Record<string, string | null | undefined>
  /** Epoch ms at which the strip starts moving. */
  startAt: number
  durationMs: number
  size?: ReelSize
  onLanded?: () => void
}) {
  const dims = SIZES[size]
  const step = dims.tile + dims.gap
  const rollKey = `${winner}|${startAt}`

  // The same strip for the same roll: seeded by the roll itself, so the admin
  // dialog and every overlay show one sequence rather than each their own.
  const strip = useMemo(() => {
    const pool = entrants.length > 0 ? entrants : [winner]
    const random = seeded(rollKey)
    return Array.from({ length: STRIP_LENGTH }, (_, index) =>
      index === WINNER_INDEX ? winner : pool[Math.floor(random() * pool.length)],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one strip per roll
  }, [rollKey])

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = frameRef.current
    if (!element) return
    const measure = () => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Where the strip's left edge sits so that tile `index` is centred.
  const offsetFor = (index: number) => width / 2 - dims.tile / 2 - index * step

  const [phase, setPhase] = useState<{ index: number; ms: number }>({ index: START_INDEX, ms: 0 })
  const [landed, setLanded] = useState(false)
  const landedRef = useRef(onLanded)
  landedRef.current = onLanded

  useEffect(() => {
    setLanded(false)
    const now = Date.now()
    const endAt = startAt + durationMs

    if (now >= endAt) {
      setPhase({ index: WINNER_INDEX, ms: 0 })
      setLanded(true)
      landedRef.current?.()
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      // Joining late: pick up the remaining time. The curve restarts rather
      // than matching exactly, which only matters to a source that reloaded
      // mid-roll, and it still lands on the same tile at the same moment.
      const remaining = Math.max(endAt - Date.now(), 0)
      setPhase({ index: WINNER_INDEX, ms: remaining })
      timers.push(
        setTimeout(() => {
          setLanded(true)
          landedRef.current?.()
        }, remaining),
      )
    }

    setPhase({ index: START_INDEX, ms: 0 })
    // A timer, not requestAnimationFrame: frames stop in a hidden or throttled
    // page, and a roll must still land on time. The floor gives the start
    // position a paint before the transition begins, when joining late.
    const wait = Math.max(startAt - now, 30)
    timers.push(setTimeout(run, wait))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restarts per roll only
  }, [rollKey, durationMs])

  return (
    <div
      ref={frameRef}
      className="relative w-full overflow-hidden"
      style={{
        height: dims.height + 8,
        // Tiles fade out towards both edges, as the reference roll does.
        maskImage: "linear-gradient(90deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
      }}
    >
      {/* The frame: fixed in the middle; the tiles pass under it. */}
      <div
        className="pointer-events-none absolute top-1 rounded-xl border transition-colors duration-300"
        style={{
          left: `calc(50% - ${dims.tile / 2 + 2}px)`,
          width: dims.tile + 4,
          height: dims.height,
          backgroundColor: "rgba(255,255,255,0.07)",
          borderColor: landed ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)",
          boxShadow: landed ? "0 0 24px rgba(255,255,255,0.08)" : undefined,
        }}
      />

      {width > 0 && (
        <div
          className="absolute left-0 top-1 flex"
          style={{
            gap: dims.gap,
            transform: `translate3d(${offsetFor(phase.index)}px, 0, 0)`,
            transition: phase.ms > 0 ? `transform ${phase.ms}ms ${EASING}` : "none",
            willChange: "transform",
          }}
        >
          {strip.map((name, index) => {
            const isWinnerTile = landed && index === WINNER_INDEX
            return (
              <div
                key={index}
                className="flex shrink-0 flex-col items-center justify-center gap-1.5"
                style={{ width: dims.tile, height: dims.height }}
                data-reel-index={index}
                data-reel-name={name}
              >
                <EntrantAvatar name={name} url={avatars?.[name]} size={dims.circle} />
                <span
                  className="max-w-full truncate px-1 font-semibold transition-colors duration-300"
                  style={{
                    fontSize: dims.name,
                    color: isWinnerTile ? "#FFFFFF" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {isWinnerTile ? name.toUpperCase() : name}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** For the tests and the overlay's catch-up: which tile the strip lands on. */
export const REEL_WINNER_INDEX = WINNER_INDEX
