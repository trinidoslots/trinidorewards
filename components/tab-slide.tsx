"use client"

import type React from "react"
import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AutoHeight } from "@/components/auto-height"

/**
 * Tab content that slides like pages being flipped.
 *
 * Picking a tab to the right: the old panel leaves to the left and the new one
 * comes in from the right. Picking one to the left: the reverse. The height
 * eases between panels of different lengths, and the slide is clipped at the
 * column's edges.
 *
 * The direction is worked out here, from the tab's position, rather than by
 * each page. It has to reach the panel that is leaving as well as the one
 * arriving, and the leaving one was rendered before the click; AnimatePresence
 * hands it the new direction through `custom`. The direction is held in state
 * and only changes when the tab does, so a re-render mid-slide (a fetch
 * landing, a timer) cannot flip it halfway.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const DISTANCE = 56

const slide = {
  enter: (direction: number) => ({ x: direction * DISTANCE, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -DISTANCE, opacity: 0 }),
}

export function TabSlide({
  tab,
  index,
  children,
  className,
}: {
  /** The current tab's id; a change starts the slide. */
  tab: string
  /** Its position in the tab bar, left to right, which decides the direction. */
  index: number
  children: React.ReactNode
  className?: string
}) {
  const [seen, setSeen] = useState({ tab, index, direction: 1 })

  // Derived during render (React's "state from props" pattern), so the first
  // frame of the slide already has the right direction.
  let direction = seen.direction
  if (seen.tab !== tab) {
    direction = index >= seen.index ? 1 : -1
    setSeen({ tab, index, direction })
  }

  return (
    <AutoHeight duration={0.3} ease={EASE}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={tab}
          custom={direction}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: EASE }}
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </AutoHeight>
  )
}
