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
export function Swap({
  on,
  children,
  className,
  distance = 6,
  duration = 0.28,
}: {
  /** Change this to replay the animation — a tab id, a selected row, anything. */
  on: string | number
  children: React.ReactNode
  className?: string
  distance?: number
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
      transition: { duration, ease: [0.2, 0.7, 0.2, 1] },
    })
  }, [on, controls, distance, duration])

  return (
    <AutoHeight className={className}>
      <motion.div initial={false} animate={controls}>
        {children}
      </motion.div>
    </AutoHeight>
  )
}
