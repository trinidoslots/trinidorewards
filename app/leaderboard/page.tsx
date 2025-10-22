"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Crown, Medal } from "lucide-react"
import Link from "next/link"
import PageTransition from "@/components/page-transition"
import { motion, AnimatePresence } from "framer-motion"

type LeaderboardEntry = {
  id: string
  rank: number
  username: string
  avatar_url: string | null
  wager_amount: number
  prize_amount: number
  isPlaceholder?: boolean
}

type Leaderboard = {
  id: string
  title: string
  subtitle: string | null
  prize_pool: number
  start_date: string
  end_date: string
  status: string
  how_it_works: any
  announcements: string[] | null
  prize_distribution_type?: string
  image_url?: string | null
}

export default function LeaderboardPage() {
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([])
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const supabase = createClient()

  useEffect(() => {
    fetchLeaderboards()
  }, [])

  useEffect(() => {
    if (selectedLeaderboardId) {
      fetchEntries(selectedLeaderboardId)
    }
  }, [selectedLeaderboardId])

  useEffect(() => {
    if (!leaderboard) return

    const updateTimer = () => {
      const end = new Date(leaderboard.end_date)
      const now = new Date()
      const diff = end.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      setTimeRemaining({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [leaderboard])

  async function fetchLeaderboards() {
    try {
      const { data: leaderboardsData, error: lbError } = await supabase
        .from("leaderboards")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })

      if (lbError) {
        if (lbError.code === "PGRST205" || lbError.message?.includes("Could not find the table")) {
          setError("database_not_setup")
          setLoading(false)
          return
        }
        console.error("[v0] Error fetching leaderboards:", lbError)
        setLoading(false)
        return
      }

      if (!leaderboardsData || leaderboardsData.length === 0) {
        setLeaderboards([])
        setLeaderboard(null)
        setLoading(false)
        return
      }

      setLeaderboards(leaderboardsData)
      const firstLeaderboard = leaderboardsData[0]
      setSelectedLeaderboardId(firstLeaderboard.id)
      setLeaderboard(firstLeaderboard)
      setLoading(false)
    } catch (err) {
      console.error("[v0] Unexpected error:", err)
      setError("unexpected")
      setLoading(false)
    }
  }

  async function fetchEntries(leaderboardId: string) {
    const { data: entriesData, error: entriesError } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("leaderboard_id", leaderboardId)
      .order("rank", { ascending: true })

    if (entriesError) {
      console.error("[v0] Error fetching entries:", entriesError)
      setEntries([])
    } else {
      setEntries(entriesData || [])
    }
  }

  function handleLeaderboardChange(leaderboardId: string) {
    const selected = leaderboards.find((lb) => lb.id === leaderboardId)
    if (selected) {
      setSelectedLeaderboardId(leaderboardId)
      setLeaderboard(selected)
    }
  }

  function handleHeaderClick() {
    if (leaderboards.length <= 1) return

    const currentIndex = leaderboards.findIndex((lb) => lb.id === selectedLeaderboardId)
    const nextIndex = (currentIndex + 1) % leaderboards.length
    const nextLeaderboard = leaderboards[nextIndex]

    setSelectedLeaderboardId(nextLeaderboard.id)
    setLeaderboard(nextLeaderboard)
  }

  function calculatePrize(rank: number, prizePool: number, distributionType = "classic"): number {
    if (distributionType === "classic") {
      // Classic Top-Heavy Split
      const distribution: { [key: number]: number } = {
        1: 0.5, // 50%
        2: 0.25, // 25%
        3: 0.15, // 15%
        4: 0.07, // 7%
        5: 0.03, // 3%
      }
      return Math.round((distribution[rank] || 0) * prizePool)
    } else if (distributionType === "balanced") {
      // Balanced Split
      const distribution: { [key: number]: number } = {
        1: 0.3, // 30%
        2: 0.2, // 20%
        3: 0.15, // 15%
        4: 0.1, // 10%
        5: 0.08, // 8%
        6: 0.034, // ~3.4%
        7: 0.034,
        8: 0.034,
        9: 0.034,
        10: 0.034,
      }
      return Math.round((distribution[rank] || 0) * prizePool)
    } else if (distributionType === "wide") {
      // Wide Distribution
      if (rank === 1) return Math.round(prizePool * 0.15) // 15%
      if (rank >= 2 && rank <= 3) return Math.round((prizePool * 0.15) / 2) // 7.5% each
      if (rank >= 4 && rank <= 10) return Math.round((prizePool * 0.2) / 7) // ~2.86% each
      return 0
    }
    return 0
  }

  const allPositions = entries.map((entry) => ({
    ...entry,
    prize_amount: leaderboard
      ? calculatePrize(entry.rank, leaderboard.prize_pool, leaderboard.prize_distribution_type)
      : 0,
  }))

  const topThree = allPositions.slice(0, 3)
  const restOfEntries = allPositions.slice(3)

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <p className="text-white text-xs">Loading...</p>
        </div>
      </PageTransition>
    )
  }

  if (error === "database_not_setup") {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-3">
          <Card className="bg-slate-900/60 backdrop-blur border border-slate-700/50 p-6 max-w-md text-center">
            <h2 className="text-lg font-bold text-white mb-3">Database Setup Required</h2>
            <p className="text-xs text-slate-400 mb-4">
              The leaderboard tables haven't been created yet. Please run the SQL script to set up the database.
            </p>
            <div className="bg-slate-900/50 border border-slate-700/50 rounded p-3 mb-4 text-left">
              <p className="text-[10px] text-slate-300 mb-2">Run this script in your Supabase SQL editor:</p>
              <code className="text-[10px] text-cyan-400">scripts/014_create_leaderboards.sql</code>
            </div>
            <div className="flex gap-2 justify-center">
              <Link href="/">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-slate-700 text-slate-300 bg-transparent"
                >
                  Go Home
                </Button>
              </Link>
              <Link href="/admin/leaderboards">
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-8 text-xs">
                  Go to Admin
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </PageTransition>
    )
  }

  if (!leaderboard) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white text-sm mb-3">No active leaderboard</p>
            <Link href="/">
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 h-8 text-xs">
                Go Home
              </Button>
            </Link>
          </div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3">
        <div className="container mx-auto max-w-7xl">
          {/* Hero Section with Timer and Header Images */}
          <div className="mb-6 text-center">
            {/* Timer */}
            <div className="mb-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                {new Date(leaderboard.start_date).toLocaleString("default", { month: "long" }).toUpperCase()}
              </p>
              <div className="flex items-center justify-center gap-3">
                <motion.div
                  key={`days-${timeRemaining.days}`}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-white text-3xl font-bold">{String(timeRemaining.days).padStart(2, "0")}</p>
                  <p className="text-slate-500 text-[10px]">Days</p>
                </motion.div>
                <div>
                  <p className="text-white text-3xl font-bold">{String(timeRemaining.hours).padStart(2, "0")}</p>
                  <p className="text-slate-500 text-[10px]">Hours</p>
                </div>
                <div>
                  <p className="text-white text-3xl font-bold">{String(timeRemaining.minutes).padStart(2, "0")}</p>
                  <p className="text-slate-500 text-[10px]">Minutes</p>
                </div>
                <div>
                  <p className="text-white text-3xl font-bold">{String(timeRemaining.seconds).padStart(2, "0")}</p>
                  <p className="text-slate-500 text-[10px]">Seconds</p>
                </div>
              </div>
            </div>

            {leaderboards.length > 0 && (
              <div className="relative z-10 my-6">
                <div className="flex justify-center gap-2 mb-6 w-fit mx-auto bg-slate-900/80 backdrop-blur-xl rounded-2xl p-2 border border-slate-700/50 shadow-2xl">
                  {leaderboards.map((lb) => (
                    <button
                      key={lb.id}
                      onClick={() => handleLeaderboardChange(lb.id)}
                      className={`relative px-6 py-3 rounded-xl transition-all duration-300 ${
                        selectedLeaderboardId === lb.id ? "bg-slate-800/80" : "hover:bg-slate-800/40 opacity-60"
                      }`}
                    >
                      {lb.image_url ? (
                        <img
                          src={lb.image_url || "/placeholder.svg"}
                          alt={lb.title}
                          className="mx-auto max-h-10 object-contain"
                          width={120}
                          height={40}
                        />
                      ) : (
                        <span
                          className={`text-sm font-bold whitespace-nowrap ${
                            selectedLeaderboardId === lb.id ? "text-white" : "text-slate-500"
                          }`}
                        >
                          {lb.title}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={leaderboard.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="mb-4"
              >
                <p className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-3xl md:text-4xl font-bold">
                  ${leaderboard.prize_pool.toLocaleString()}
                </p>
                {leaderboard.subtitle && (
                  <p className="text-slate-400 text-sm mt-2 max-w-2xl mx-auto">{leaderboard.subtitle}</p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={leaderboard.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
              {/* Left Column - Top 3 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="lg:col-span-1 space-y-4"
              >
                {/* Top 3 */}
                <div className="bg-gradient-to-r from-amber-900/20 to-purple-900/20 backdrop-blur border border-amber-700/30 rounded-lg p-3">
                  <h2 className="text-white text-xs font-semibold mb-3 flex items-center gap-2">
                    <div className="w-1 h-3 bg-amber-500 rounded"></div>
                    TOP 3
                  </h2>
                  <div className="space-y-3">
                    {topThree.map((entry, index) => {
                      const icons = [
                        { Icon: Crown, color: "text-amber-400", bg: "bg-amber-500/20" },
                        { Icon: Medal, color: "text-slate-400", bg: "bg-slate-500/20" },
                        { Icon: Medal, color: "text-orange-500", bg: "bg-orange-500/20" },
                      ]
                      const { Icon, color, bg } = icons[index]

                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                          className="flex items-center gap-2 bg-slate-900/40 rounded p-2"
                        >
                          <div className={`${bg} rounded p-1.5`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={`${color}/70 text-[10px] uppercase tracking-wider`}>#{entry.rank}</p>
                              <p className={`${color.replace("400", "300")} text-sm font-bold`}>
                                ${entry.prize_amount.toLocaleString()}
                              </p>
                            </div>
                            <p className={`${color} text-xs font-medium truncate`}>{entry.username}</p>
                            <p className="text-slate-500 text-[10px]">${entry.wager_amount.toLocaleString()} wagered</p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>

              {/* Right Column - Full Rankings */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="lg:col-span-2"
              >
                <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur h-full">
                  <CardContent className="p-3">
                    <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-cyan-500 rounded"></div>
                      FULL RANKINGS ({allPositions.length} {allPositions.length === 1 ? "ENTRY" : "ENTRIES"})
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                              Rank
                            </th>
                            <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                              Username
                            </th>
                            <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                              Wager
                            </th>
                            <th className="text-left py-1.5 px-2 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                              Prize
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {allPositions.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-slate-500 text-xs">
                                No entries yet
                              </td>
                            </tr>
                          ) : (
                            allPositions.map((entry, index) => (
                              <motion.tr
                                key={entry.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: 0.3 + index * 0.03 }}
                                className="border-b border-slate-700/50 hover:bg-slate-700/20"
                              >
                                <td className="py-1.5 px-2 text-white text-xs font-bold">{entry.rank}</td>
                                <td className="py-1.5 px-2 text-xs text-white">{entry.username}</td>
                                <td className="py-1.5 px-2 text-slate-400 text-xs">
                                  ${entry.wager_amount.toLocaleString()}
                                </td>
                                <td className="py-1.5 px-2 text-amber-400 text-xs font-bold">
                                  ${entry.prize_amount.toLocaleString()}
                                </td>
                              </motion.tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  )
}
