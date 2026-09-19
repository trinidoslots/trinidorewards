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
  /** Layout and typography — always applied. */
  className?: string
  /**
   * Colour for an actual amount (the red/green of a deposit or cashout). Dropped
   * at zero: a dash means "nothing here", so tinting it green would read as a
   * positive balance rather than an absent one.
   */
  toneClassName?: string
  /** Colour for the zero dash. */
  zeroClassName?: string
  /** Extra class applied only while a change is animating, e.g. a glow. */
  pulseClassName?: string
}

const ZERO_DASH = "-"

// Animates deposit/cashout figures with a spring count-up/down plus a brief pop
// whenever the underlying value actually changes. Renders a bare dash (no "$")
// when the value is zero, instead of "$0" or "-$0".
export function AnimatedAmount({
  value,
  sign = "auto",
  className,
  toneClassName,
  zeroClassName = "text-white",
  pulseClassName,
}: AnimatedAmountProps) {
  const motionValue = useMotionValue(value)
  // Critically damped: damping = 2 * sqrt(stiffness * mass) is the point where
  // a spring stops overshooting. At 20 it was under that (2*sqrt(140*0.9) =
  // 22.4), so every count ran past its target and came back — which on the way
  // to zero meant the net briefly showed as negative.
  const spring = useSpring(motionValue, { stiffness: 140, damping: 23, mass: 0.9 })
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

  /*
   * The dash needs the target *and* the frame to be at zero.
   *
   * Keying it off the target alone fixed one direction and broke the other.
   * Counting up from zero passes through sub-$1 frames, and flashing a dash
   * there looked like the value had been cleared — hence the target. But going
   * the other way, the target hits zero on the first frame, so a net walking
   * down from $5,000 showed a dash immediately and the spring counted down
   * behind a character nobody could see. It read as a jump because it was one.
   *
   * Both at zero: the dash waits for the count to arrive.
   */
  const shown = Math.round(display)
  const isZero = Math.round(value) === 0 && shown === 0
  const rounded = Math.abs(shown)
  // The sign follows the frame, not the target. On the way down from -$5,000
  // the target is already 0, whose sign is "+", which would have put a plus in
  // front of every negative frame on the way there.
  const prefix = sign === "auto" ? (shown < 0 ? "-" : "+") : sign

  return (
    <motion.span
      animate={pulse ? { scale: [1, 1.18, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`${className ?? ""} ${isZero ? zeroClassName : (toneClassName ?? "")} ${
        pulse ? (pulseClassName ?? "") : ""
      }`}
    >
      {isZero ? ZERO_DASH : `${prefix}$${rounded.toLocaleString("en-US")}`}
    </motion.span>
  )
}
