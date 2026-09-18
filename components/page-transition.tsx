"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

/**
 * The handover between pages.
 *
 * Keyed on the path, so the outgoing page fades up and out while the new one
 * arrives from below. Short on purpose — this sits between a click and the
 * thing you clicked for, and anything longer than about a quarter of a second
 * stops reading as polish and starts reading as lag.
 *
 * mode="wait" would double that by finishing the exit before the entry starts,
 * so the two overlap instead; "popLayout" keeps the outgoing page out of the
 * flow so they do not shove each other around while they cross.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
