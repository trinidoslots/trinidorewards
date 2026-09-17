"use client"

import { useEffect, useState } from "react"
import { getTimeRemaining } from "@/lib/raffle-utils"

interface RaffleCountdownProps {
  endDate: string
}

export function RaffleCountdown({ endDate }: RaffleCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(endDate))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(endDate))
    }, 1000)

    return () => clearInterval(interval)
  }, [endDate])

  if (timeRemaining.expired) {
    return (
      <div className="text-center">
        <div className="text-sm text-slate-400 mb-1">Draw Completed</div>
        <div className="text-2xl font-bold text-red-400">ENDED</div>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="text-sm text-slate-400 mb-1">Time Remaining</div>
      <div className="text-2xl font-bold text-cyan-400">
        {timeRemaining.days > 0 && `${timeRemaining.days}D `}
        {timeRemaining.hours > 0 && `${timeRemaining.hours}H `}
        {timeRemaining.minutes}M {timeRemaining.seconds}S
      </div>
    </div>
  )
}
