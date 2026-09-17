"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowRight,
  Award,
  ChevronRight,
  Clock3,
  Crown,
  Crosshair,
  Gift,
  Instagram,
  Play,
  ShoppingBag,
  Trophy,
  Users,
  Youtube,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const opportunities = [
  {
    href: "/bonushunt",
    label: "BONUS HUNT",
    title: "Guess the balance",
    description: "Follow the hunt, lock in your prediction, and compete for the closest call.",
    icon: Crosshair,
    accent: "cyan",
  },
  {
    href: "/leaderboard",
    label: "LEADERBOARD",
    title: "Climb the ranks",
    description: "Turn your play into progress and see who is leading the community.",
    icon: Crown,
    accent: "blue",
  },
  {
    href: "/raffles",
    label: "RAFFLES",
    title: "More ways to win",
    description: "Enter community draws and keep an eye on the next reward drop.",
    icon: Gift,
    accent: "sky",
  },
]

const accentClasses = {
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200 group-hover:border-cyan-200/55",
  blue: "border-blue-300/25 bg-blue-300/10 text-blue-200 group-hover:border-blue-200/55",
  sky: "border-sky-300/25 bg-sky-300/10 text-sky-200 group-hover:border-sky-200/55",
}

export default function LandingPage() {
  const [totalGivenAway, setTotalGivenAway] = useState("432,565")
  const [timeLeft, setTimeLeft] = useState("02:14:36")

  useEffect(() => {
    const fetchTotalGivenAway = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.from("settings").select("value").eq("key", "total_given_away").single()
        if (data?.value) setTotalGivenAway(Number.parseInt(data.value).toLocaleString())
      } catch (error) {
        console.log("[v0] Error fetching total given away:", error)
      }
    }

    fetchTotalGivenAway()
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        const parts = current.split(":").map(Number)
        let seconds = parts[0] * 3600 + parts[1] * 60 + parts[2] - 1
        if (seconds < 0) seconds = 86399
        return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
          .map((value) => String(value).padStart(2, "0"))
          .join(":")
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(56,189,248,0.16),transparent_36%)]" />
      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="[animation-delay:120ms]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            <span className="landing-pulse h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" /> The rewards community
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl">
            Play more.<br /><span className="text-cyan-300">Get rewarded.</span>
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            Your home for bonus hunts, community competitions, exclusive offers, and rewards worth chasing.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/bonushunt" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3.5 font-bold text-slate-950 shadow-xl shadow-cyan-400/15 transition hover:bg-cyan-200">
              Explore bonus hunt <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/leaderboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-6 py-3.5 font-bold text-slate-100 transition hover:border-cyan-200/40 hover:bg-slate-800">
              View leaderboard
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-cyan-300" /> 10K+ members</span>
            <span className="inline-flex items-center gap-2"><Award className="h-4 w-4 text-cyan-300" /> ${totalGivenAway}+ given away</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[2rem] bg-cyan-300/10 blur-3xl" />
          <div className="relative rounded-xl border border-cyan-200/20 bg-slate-900/90 p-5 shadow-lg shadow-cyan-950/30 transition duration-300 hover:border-cyan-200/40">
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Live reward drop</p><p className="mt-1 text-lg font-bold text-white">Monthly leaderboard</p></div>
              <div className="rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><Trophy className="h-5 w-5" /></div>
            </div>
            <div className="space-y-3 py-5">
              {["Tyceno", "LuckyLeo", "NateWins"].map((name, index) => (
                <div key={name} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-cyan-200">{index + 1}</span>
                  <span className="flex-1 font-semibold text-slate-200">{name}</span><span className="font-bold text-cyan-200">${[1250, 890, 640][index]}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-cyan-300/10 px-4 py-3"><span className="text-sm text-slate-300">Next draw in</span><span className="font-mono font-bold text-cyan-200">{timeLeft}</span></div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-24 [animation-delay:380ms] lg:px-8">
        <div className="mb-8 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Your next move</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Find your way in</h2></div><Link href="/bonuses" className="hidden items-center gap-1 text-sm font-semibold text-slate-300 hover:text-cyan-200 sm:flex">All rewards <ChevronRight className="h-4 w-4" /></Link></div>
        <div className="grid gap-4 md:grid-cols-3">
          {opportunities.map(({ href, label, title, description, icon: Icon, accent }) => (
            <Link key={href} href={href} className="group rounded-xl border border-slate-800 bg-slate-900/70 p-6 transition duration-300 ease-out hover:-translate-y-1 hover:border-cyan-200/30 hover:bg-slate-900 hover:shadow-xl hover:shadow-cyan-950/20">
              <div className={`mb-8 flex h-11 w-11 items-center justify-center rounded-xl border ${accentClasses[accent as keyof typeof accentClasses]}`}><Icon className="h-5 w-5" /></div>
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">{label}</p><h3 className="mt-2 text-xl font-bold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{description}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-5 px-5 pb-24 [animation-delay:520ms] lg:grid-cols-[1.25fr_0.75fr] lg:px-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-7 sm:p-9"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Watch live</p><h2 className="mt-2 text-2xl font-bold text-white">Join the action</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Catch the stream, follow the hunt, and stay close to the next community reward.</p></div><div className="rounded-xl bg-cyan-300/10 p-3 text-cyan-200"><Play className="h-5 w-5 fill-current" /></div></div><div className="mt-8 flex min-h-32 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/80"><a href="https://kick.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200"><Play className="h-4 w-4 fill-current" /> Watch on Kick</a></div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-7 sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Stay connected</p><h2 className="mt-2 text-2xl font-bold text-white">Never miss a drop</h2><p className="mt-3 text-sm leading-6 text-slate-400">Follow along for announcements, winners, and new ways to earn.</p><div className="mt-8 flex gap-3"><a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="rounded-lg border border-slate-700 p-3 text-slate-300 transition hover:border-cyan-200/40 hover:text-cyan-200"><Youtube className="h-5 w-5" /></a><a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="rounded-lg border border-slate-700 p-3 text-slate-300 transition hover:border-cyan-200/40 hover:text-cyan-200"><Instagram className="h-5 w-5" /></a><Link href="/store" aria-label="Store" className="rounded-lg border border-slate-700 p-3 text-slate-300 transition hover:border-cyan-200/40 hover:text-cyan-200"><ShoppingBag className="h-5 w-5" /></Link></div></div>
      </section>

      <footer className="border-t border-slate-900 px-5 py-8 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>TrinidoRewards © 2026</span><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" /> 18+ only. Play responsibly.</span></div></footer>
    </main>
  )
}

