"use client"

import { useEffect, useState } from "react"

interface GamesProgressBarProps {
  completed: number
  total: number
}

export function GamesProgressBar({ completed, total }: GamesProgressBarProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Animate progress bar on mount
    const timer = setTimeout(() => {
      setProgress((completed / total) * 100)
    }, 100)
    return () => clearTimeout(timer)
  }, [completed, total])

  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm font-medium">Games Progress</span>
        <span className="text-white text-sm font-bold">
          {completed} / {total} opened
        </span>
      </div>
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-green-500 transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
