"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { PageTransition } from "@/components/page-transition"
import { Crown, Target, TrendingUp, Award, Crosshair, Trophy, ShoppingCart, Gift } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export default function LandingPage() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const [totalGivenAway, setTotalGivenAway] = useState("432,565")

  useEffect(() => {
    fetchTotalGivenAway()
  }, [])

  async function fetchTotalGivenAway() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("settings").select("*").eq("key", "total_given_away").single()

      if (!error && data) {
        // Format number with commas
        const formatted = Number.parseInt(data.value).toLocaleString()
        setTotalGivenAway(formatted)
      } else if (error) {
        console.log("[v0] Settings table not found or error fetching data, using default value")
        // Keep default value if table doesn't exist yet
      }
    } catch (err) {
      console.log("[v0] Error fetching total given away:", err)
      // Keep default value on error
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-white text-5xl md:text-7xl font-bold mb-6 leading-tight">
              DIVE INTO
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
                VIP EXPERIENCE
              </span>
            </h1>
            <p className="text-slate-300 text-lg md:text-xl mb-10 leading-relaxed max-w-2xl mx-auto">
              Enjoy exclusive bonuses, participate in raffles, guess the ending balance of bonus hunts and much more!
              Become a part of the best community on Kick now!
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/bonuses"
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
              >
                Claim Bonuses
              </Link>
              <Link
                href="/leaderboard"
                className="px-8 py-4 bg-transparent border-2 border-blue-500 hover:bg-blue-500/10 text-blue-400 rounded-lg font-semibold transition-all"
              >
                Wager Milestones
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <motion.section
          className="container mx-auto px-4 pb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Wager Leaderboard */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/leaderboard"
                className="group relative overflow-hidden bg-gradient-to-br from-amber-900/30 via-amber-800/10 to-slate-900/50 backdrop-blur-sm border border-amber-700/30 rounded-2xl p-8 hover:border-amber-500/60 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="absolute inset-0 bg-[url('/golden-flames-pattern.jpg')] opacity-5 bg-cover"></div>
                <div className="relative flex-1 flex flex-col">
                  <div className="w-16 h-16 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500/30 transition-colors">
                    <Crown className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                    Wager Leaderboard
                  </h3>
                  <p className="text-slate-400 text-sm">Compete for top prizes</p>
                </div>
              </Link>
            </motion.div>

            {/* Schedule */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/bonushunt"
                className="group relative overflow-hidden bg-gradient-to-br from-red-900/30 via-purple-800/10 to-slate-900/50 backdrop-blur-sm border border-red-700/30 rounded-2xl p-8 hover:border-red-500/60 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="absolute inset-0 bg-[url('/target-bullseye-pattern.jpg')] opacity-5 bg-cover"></div>
                <div className="relative flex-1 flex flex-col">
                  <div className="w-16 h-16 bg-red-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-500/30 transition-colors">
                    <Target className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                    Schedule
                  </h3>
                  <p className="text-slate-400 text-sm">Track upcoming events</p>
                </div>
              </Link>
            </motion.div>

            {/* Wager Milestones */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/leaderboard"
                className="group relative overflow-hidden bg-gradient-to-br from-green-900/30 via-emerald-800/10 to-slate-900/50 backdrop-blur-sm border border-green-700/30 rounded-2xl p-8 hover:border-green-500/60 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="absolute inset-0 bg-[url('/ascending-stairs-pattern.jpg')] opacity-5 bg-cover"></div>
                <div className="relative flex-1 flex flex-col">
                  <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-500/30 transition-colors">
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                    Wager Milestones
                  </h3>
                  <p className="text-slate-400 text-sm">Unlock exclusive rewards</p>
                </div>
              </Link>
            </motion.div>

            {/* VIP Transfer */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/bonuses"
                className="group relative overflow-hidden bg-gradient-to-br from-slate-800/30 via-slate-700/10 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-8 hover:border-slate-500/60 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="absolute inset-0 bg-[url('/vip-badge-pattern.jpg')] opacity-5 bg-cover"></div>
                <div className="relative flex-1 flex flex-col">
                  <div className="w-16 h-16 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-500/30 transition-colors">
                    <Award className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                    VIP Transfer
                  </h3>
                  <p className="text-slate-400 text-sm">Premium benefits await</p>
                </div>
              </Link>
            </motion.div>
          </div>
        </motion.section>

        {/* Stats Section */}
        <motion.section
          className="container mx-auto px-4 py-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
        >
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-12 md:p-16">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-white text-4xl md:text-5xl font-bold mb-4 leading-tight">
                    TOTAL
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                      GIVEAWAY
                    </span>
                  </h2>
                  <p className="text-slate-400 text-sm uppercase tracking-wider font-semibold bg-white/5 inline-block px-4 py-2 rounded-lg">
                    TO TrinidoRewards COMMUNITY
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
                    ${totalGivenAway}+
                  </div>
                  <p className="text-slate-400 text-sm mt-2">And counting...</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Features Grid */}
        <motion.section
          className="container mx-auto px-4 pb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Bonus Hunt */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/bonushunt"
                className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-cyan-500/50 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="w-16 h-16 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                  <Crosshair className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                  Bonus Hunt
                </h3>
                <p className="text-slate-400 text-sm">Track your bonus rounds</p>
              </Link>
            </motion.div>

            {/* Tournaments */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/tournaments"
                className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/50 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="w-16 h-16 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                  <Trophy className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                  Tournaments
                </h3>
                <p className="text-slate-400 text-sm">Join competitive events</p>
              </Link>
            </motion.div>

            {/* Stream Store */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/store"
                className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/50 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                  <ShoppingCart className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                  Stream Store
                </h3>
                <p className="text-slate-400 text-sm">Exclusive merchandise</p>
              </Link>
            </motion.div>

            {/* Raffles */}
            <motion.div variants={fadeInUp} className="h-full">
              <Link
                href="/raffles"
                className="group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-pink-500/50 transition-all hover:scale-105 block h-full flex flex-col"
              >
                <div className="w-16 h-16 bg-pink-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-pink-500/20 transition-colors">
                  <Gift className="w-8 h-8 text-pink-400" />
                </div>
                <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-2 transition-all group-hover:text-2xl">
                  Raffles
                </h3>
                <p className="text-slate-400 text-sm">Win amazing prizes</p>
              </Link>
            </motion.div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          className="container mx-auto px-4 pb-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
        >
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-900/30 via-slate-800/30 to-slate-900/30 backdrop-blur-xl border border-blue-700/30 rounded-3xl p-12 md:p-16 text-center">
            <div className="mb-8">
              <div className="text-6xl md:text-7xl font-bold text-white mb-4" style={{ fontFamily: "cursive" }}>
                Stake
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-2">
                <span className="text-cyan-400">WORLD'S LARGEST</span> <span className="text-white">ONLINE CASINO</span>
              </h3>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href="https://stake.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold transition-all shadow-lg"
              >
                🎰 STAKE.COM
              </a>
              <a
                href="https://stake.us"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg"
              >
                🇺🇸 STAKE.US
              </a>
            </div>
            <p className="text-slate-400 text-xs mt-6 uppercase tracking-wider">Terms may apply. Strictly 18+ only</p>
          </div>
        </motion.section>
      </div>
    </PageTransition>
  )
}
