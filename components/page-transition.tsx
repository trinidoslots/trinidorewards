"use client"

import { usePathname } from "next/navigation"
import { motion } from "framer-motion"

/**
 * The new page arrives. The old one does not linger.
 *
 * This animated the exit too, through AnimatePresence, and that was wrong for
 * the same reason it looked right on paper: both pages are mounted while they
 * cross. Measured, <main> held two children for about 250ms on every
 * navigation — the old page and the new one, side by side. On pages that fetch
 * on mount that also meant two rounds of requests, and it read exactly as what
 * it was: the page loading twice.
 *
 * Keying a plain motion.div on the path instead means React unmounts the old
 * subtree the moment the route changes and the new one plays its entry. One
 * page at a time, and no waiting for an exit before the thing you clicked for
 * appears.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
