"use client"

import { useEffect, useRef } from "react"
import { motion, useAnimationControls } from "framer-motion"
import { AutoHeight } from "@/components/auto-height"

/**
 * Replays an entry animation whenever `on` changes, and eases the height
 * between whatever is inside.
 *
 * Two things were making tab switches read as no animation at all.
 *
 * The first was the height. The bonus hunt panels already faded their incoming
 * content in — measured, 73 opacity steps over 300ms — but the container
 * snapped from one panel's height to the other's in a single frame. A fade you
 * cannot see because the page jolted underneath it is not a fade. AutoHeight
 * measures the content and animates the number.
 *
 * The second was that the leaderboard switch had no animation of any kind.
 *
 * Nothing is unmounted. Keying a wrapper would have been shorter, but the
 * previous-hunts panel fetches on mount, and remounting it on every switch back
 * is the double-load this codebase has already been bitten by. So the children
 * stay where they are and the animation is driven imperatively instead.
 */
/**
 * One curve for the height and the content both.
 *
 * The previous one, [0.16, 1, 0.3, 1], was an expo-out: measured against the
 * CSS solver it covered 83% of the distance in the first quarter of the
 * duration and was 90% done a third of the way through. Of a half-second
 * switch you only ever saw about 165ms of movement, so raising the duration
 * lengthened a tail nobody could see. This one reaches 90% at 64% of the
 * duration, which puts the motion where the time is.
 */
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

export function Swap({
  on,
  children,
  className,
  distance = 10,
  duration = 0.5,
}: {
  /** Change this to replay the animation — a tab id, a selected row, anything. */
  on: string | number
  children: React.ReactNode
  className?: string
  /** How far the incoming content rises, in pixels. */
  distance?: number
  /**
   * Seconds. The dial if a switch feels rushed or sluggish. It drives the
   * height and the content together, which is the point: they ran at 0.34 and
   * 0.28 before, close enough to look like one animation and different enough
   * to feel like a slip.
   */
  duration?: number
}) {
  const controls = useAnimationControls()
  const first = useRef(true)

  useEffect(() => {
    // The first render is an arrival, not a switch. Animating it would fight
    // whatever brought the page in.
    if (first.current) {
      first.current = false
      return
    }
    controls.set({ opacity: 0, y: distance })
    void controls.start({
      opacity: 1,
      y: 0,
      transition: { duration, ease: EASE },
    })
  }, [on, controls, distance, duration])

  return (
    <AutoHeight className={className} duration={duration} ease={EASE}>
      <motion.div initial={false} animate={controls}>
        {children}
      </motion.div>
    </AutoHeight>
  )
}
