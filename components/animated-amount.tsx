"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

interface AnimatedAmountProps {
  value: number
  /**
   * Fixed prefix for figures whose direction is inherent to the field (a deposit
   * is always "-", a withdraw always "+"), or "auto" to take it from the value —
   * used for net figures that can legitimately swing either way.
   */
  sign?: "+" | "-" | "auto"
  className?: string
  /** Extra class applied only while a change is animating, e.g. a glow. */
  pulseClassName?: string
}

const ZERO_DASH = "-"

// Animates deposit/cashout figures with a spring count-up/down plus a brief pop
// whenever the underlying value actually changes. Renders a bare dash (no "$")
// when the value is zero, instead of "$0" or "-$0".
export function AnimatedAmount({ value, sign = "auto", className, pulseClassName }: AnimatedAmountProps) {
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, { stiffness: 140, damping: 20, mass: 0.9 })
  const [display, setDisplay] = useState(value)
  const [pulse, setPulse] = useState(false)
  const previousValue = useRef(value)

  useEffect(() => {
    if (value === previousValue.current) return
    motionValue.set(value)
    previousValue.current = value
    setPulse(true)
    const timeout = setTimeout(() => setPulse(false), 500)
    return () => clearTimeout(timeout)
  }, [value, motionValue])

  useEffect(() => spring.on("change", setDisplay), [spring])

  // The dash is keyed off the *target*, not the interpolated frame: counting up
  // from zero passes through sub-$1 frames, and flashing a dash there looked
  // like the value had been cleared.
  const isZero = Math.round(value) === 0
  const rounded = Math.abs(Math.round(display))
  const prefix = sign === "auto" ? (value < 0 ? "-" : "+") : sign

  return (
    <motion.span
      animate={pulse ? { scale: [1, 1.18, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`${className ?? ""} ${pulse ? (pulseClassName ?? "") : ""}`}
    >
      {isZero ? ZERO_DASH : `${prefix}$${rounded.toLocaleString()}`}
    </motion.span>
  )
}
