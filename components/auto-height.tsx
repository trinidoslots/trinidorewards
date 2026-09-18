"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

/**
 * Eases a container between the heights of whatever it is given.
 *
 * framer-motion's `layout` prop does not do this job here: it animates by
 * scaling, which distorts the children, and paired with AnimatePresence's
 * "wait" mode it measured nothing at all — the height jumped between the two
 * stages in every one of 2000 sampled frames. This measures the content
 * directly and animates the number.
 *
 * A measured height of zero is ignored. While one stage is leaving and the
 * next has not arrived there is nothing inside, and collapsing to zero and
 * back would be a worse jump than the one being fixed.
 */
export function AutoHeight({
  children,
  duration = 0.34,
  ease = [0.22, 1, 0.36, 1],
  className,
}: {
  children: React.ReactNode
  duration?: number
  /** Override so a caller can keep the height on the same curve as its content. */
  ease?: [number, number, number, number]
  className?: string
}) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | "auto">("auto")

  useEffect(() => {
    const node = inner.current
    if (!node) return

    const observer = new ResizeObserver(([entry]) => {
      const measured = entry.contentRect.height
      if (measured > 0) setHeight(measured)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      animate={{ height }}
      transition={{ duration, ease }}
      style={{ overflow: "hidden" }}
      className={className}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}
