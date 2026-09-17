"use client"

import { useEffect, useState } from "react"
import { ACCENTS } from "@/components/ui/panel"

interface GamesProgressBarProps {
  completed: number
  total: number
}

/**
 * The bar alone — its caller supplies the caption, since the counts are shown
 * differently on the hunt page and in the OBS widget.
 */
export function GamesProgressBar({ completed, total }: GamesProgressBarProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Animate from zero on mount rather than snapping to the final width.
    const timer = setTimeout(() => setProgress(total ? (completed / total) * 100 : 0), 100)
    return () => clearTimeout(timer)
  }, [completed, total])

  return (
    <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${ACCENTS.blue}, ${ACCENTS.green})`,
        }}
      />
    </div>
  )
}
