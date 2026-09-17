"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"

interface Reward {
  id: string
  title: string
  description: string
  icon: string
  reward_value: string
}

interface Props {
  rewards: Reward[]
  wonReward: Reward
  onComplete: () => void
}

export function RewardRollAnimation({ rewards, wonReward, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRolling, setIsRolling] = useState(true)
  const [speed, setSpeed] = useState(100)

  useEffect(() => {
    if (!isRolling) return

    // Create a rolling sequence that ends on the won reward
    let rollCount = 0
    const maxRolls = 20 + Math.floor(Math.random() * 10) // 20-30 rolls

    const interval = setInterval(() => {
      rollCount++

      // Speed up initially, then slow down near the end
      if (rollCount < 5) {
        setSpeed(100)
      } else if (rollCount < 10) {
        setSpeed(80)
      } else if (rollCount > maxRolls - 8) {
        setSpeed(200)
      } else if (rollCount > maxRolls - 5) {
        setSpeed(400)
      } else if (rollCount > maxRolls - 3) {
        setSpeed(600)
      }

      // On the last roll, land on the won reward
      if (rollCount >= maxRolls) {
        const wonIndex = rewards.findIndex((r) => r.id === wonReward.id)
        setCurrentIndex(wonIndex)
        setIsRolling(false)
        clearInterval(interval)

        // Wait a moment before calling onComplete
        setTimeout(() => {
          onComplete()
        }, 1500)
      } else {
        // Cycle through rewards
        setCurrentIndex((prev) => (prev + 1) % rewards.length)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [isRolling, speed, rewards, wonReward, onComplete])

  const currentReward = rewards[currentIndex]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mb-6"
        >
          <h2 className="text-3xl font-bold text-yellow-400 mb-2">Rolling Your Reward...</h2>
          <p className="text-slate-300">Good luck!</p>
        </motion.div>

        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-yellow-500/50 p-8 relative overflow-hidden">
          {/* Animated background */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/10"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />

          {/* Reward display */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentReward.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative z-10 text-center"
            >
              <div className="text-8xl mb-4">{currentReward.icon}</div>
              <h3 className="text-2xl font-bold text-yellow-400 mb-2">{currentReward.title}</h3>
              <p className="text-slate-300 text-sm mb-2">{currentReward.description}</p>
              <div className="text-lg font-semibold text-white bg-slate-800/50 rounded-lg py-2 px-4 inline-block">
                {currentReward.reward_value}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Rolling indicator */}
          {isRolling && (
            <motion.div
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
            >
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                <div className="w-2 h-2 bg-yellow-400 rounded-full" />
              </div>
            </motion.div>
          )}
        </Card>

        {!isRolling && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center mt-6">
            <div className="text-2xl font-bold text-green-400">🎉 Congratulations! 🎉</div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
