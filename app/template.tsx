"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  /**
   * OBS routes get none of this, for three reasons, in order of how badly
   * they bite:
   *
   *  - The animation starts at opacity 0. A browser source whose JavaScript
   *    does not run — or does not run yet — is then not a dark overlay, it is
   *    no overlay at all, and nothing on screen says why.
   *  - A transform makes the element the containing block for every
   *    position: fixed descendant. /obs/casino-frame pins itself to the
   *    viewport to sit flush in its source; inside this wrapper it was
   *    measured from here instead and started 6px down. The same trap is
   *    already documented in ConditionalLayout for the admin sidebar.
   *  - An entry animation is feedback for a click. These pages are opened
   *    once by OBS and never navigate.
   *
   * ConditionalLayout draws the same line for the same pages; a template sits
   * inside it, so opting out there was not enough.
   */
  const isOBSPage = pathname === "/predictionobs" || pathname.startsWith("/obs/")

  if (isOBSPage) return <>{children}</>

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
