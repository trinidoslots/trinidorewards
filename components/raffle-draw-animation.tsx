"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Trophy, Sparkles } from "lucide-react"
import confetti from "canvas-confetti"

interface RaffleDrawAnimationProps {
  isOpen: boolean
  onClose: () => void
  participants: string[]
  winner: string
  ticketNumber: number
  prizeName: string
}

export function RaffleDrawAnimation({
  isOpen,
  onClose,
  participants,
  winner,
  ticketNumber,
  prizeName,
}: RaffleDrawAnimationProps) {
  const [currentName, setCurrentName] = useState("")
  const [isSpinning, setIsSpinning] = useState(true)
  const [showWinner, setShowWinner] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setIsSpinning(true)
      setShowWinner(false)
      return
    }

    // Spinning animation
    let spinInterval: NodeJS.Timeout
    let spinSpeed = 50 // Start fast

    const spin = () => {
      spinInterval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * participants.length)
        setCurrentName(participants[randomIndex])
      }, spinSpeed)
    }

    spin()

    // Slow down and reveal winner
    const slowDownTimers: NodeJS.Timeout[] = []

    // Gradually slow down
    slowDownTimers.push(
      setTimeout(() => {
        clearInterval(spinInterval)
        spinSpeed = 100
        spin()
      }, 2000),
    )

    slowDownTimers.push(
      setTimeout(() => {
        clearInterval(spinInterval)
        spinSpeed = 200
        spin()
      }, 3000),
    )

    slowDownTimers.push(
      setTimeout(() => {
        clearInterval(spinInterval)
        spinSpeed = 400
        spin()
      }, 4000),
    )

    // Final reveal
    slowDownTimers.push(
      setTimeout(() => {
        clearInterval(spinInterval)
        setIsSpinning(false)
        setCurrentName(winner)
        setShowWinner(true)

        // Trigger confetti
        const duration = 3000
        const end = Date.now() + duration

        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ["#06b6d4", "#3b82f6", "#8b5cf6", "#f59e0b"],
          })
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ["#06b6d4", "#3b82f6", "#8b5cf6", "#f59e0b"],
          })

          if (Date.now() < end) {
            requestAnimationFrame(frame)
          }
        }
        frame()
      }, 5000),
    )

    return () => {
      clearInterval(spinInterval)
      slowDownTimers.forEach((timer) => clearTimeout(timer))
    }
  }, [isOpen, participants, winner])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border-slate-700 bg-slate-900">
        <div className="py-12 text-center space-y-8">
          {/* Prize Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-amber-500">
              <Trophy className="w-8 h-8" />
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">Drawing Winner</h2>
            <p className="text-slate-400">{prizeName}</p>
          </div>

          {/* Spinning Name Display */}
          <div className="relative">
            <div
              className={`
              text-6xl font-black text-center py-12 px-8 rounded-2xl
              bg-gradient-to-br from-slate-800 to-slate-900
              border-4 transition-all duration-300
              ${
                isSpinning
                  ? "border-cyan-500 shadow-lg shadow-cyan-500/20 scale-105"
                  : "border-amber-500 shadow-2xl shadow-amber-500/30 scale-110"
              }
            `}
            >
              <div
                className={`
                transition-all duration-300
                ${
                  isSpinning
                    ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400"
                    : "text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400"
                }
              `}
              >
                {currentName || "..."}
              </div>
            </div>

            {/* Spinning indicator */}
            {isSpinning && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent" />
              </div>
            )}
          </div>

          {/* Winner Reveal */}
          {showWinner && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                🎉 CONGRATULATIONS! 🎉
              </div>
              <div className="text-slate-400">
                Winning Ticket: <span className="text-white font-bold">#{ticketNumber}</span>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
