"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  )
}

export default PageTransition
