"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

interface AnimatedAmountProps {
  value: number
  sign: "+" | "-"
  className?: string
}

// Animates deposit/cashout figures with a spring count-up/down and a brief pop
// whenever the underlying value actually changes. Shows a bare dash (no "$")
// once the settled value reaches zero, instead of "$0" or "-$0".
export function AnimatedAmount({ value, sign, className }: AnimatedAmountProps) {
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, { stiffness: 140, damping: 20, mass: 0.9 })
  const [display, setDisplay] = useState(value)
  const [pulse, setPulse] = useState(false)
  const previousValue = useRef(value)

  useEffect(() => {
    if (value !== previousValue.current) {
      motionValue.set(value)
      previousValue.current = value
      setPulse(true)
      const timeout = setTimeout(() => setPulse(false), 500)
      return () => clearTimeout(timeout)
    }
  }, [value, motionValue])

  useEffect(() => {
    return spring.on("change", (latest) => setDisplay(latest))
  }, [spring])

  const rounded = Math.round(display)
  const isZero = Math.abs(rounded) < 1

  return (
    <motion.span
      animate={pulse ? { scale: [1, 1.18, 1] } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      {isZero ? "-" : `${sign}$${Math.abs(rounded).toLocaleString()}`}
    </motion.span>
  )
}
