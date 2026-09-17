"use client"

import { useEffect, useRef, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { HuntKpis } from "@/lib/active-hunt"
import { GamesProgressBar } from "@/components/games-progress-bar"
import { PredictionsLeaderboard } from "@/components/predictions-leaderboard"
import { HuntKpiBoard } from "@/components/hunt-kpi-board"

type BonusHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
  is_super: boolean
  image_url?: string | null
}

export type { HuntKpis }

type Props = {
  initialHunts: BonusHunt[]
  activeTab: string
  huntSource?: "integrated" | "external"
  huntId?: string | null
  initialStartingBalance?: number
  initialKpis?: HuntKpis | null
  currentUsername?: string
}

export function BonusHuntClient({
  initialHunts,
  huntSource = "integrated",
  huntId = null,
  initialStartingBalance = 0,
  initialKpis = null,
  currentUsername,
}: Props) {
  const [allHunts, setAllHunts] = useState<BonusHunt[]>(initialHunts)
  const [startingBalance, setStartingBalance] = useState(initialStartingBalance)
  const [kpis, setKpis] = useState<HuntKpis | null>(initialKpis)
  const supabaseRef = useRef(createBrowserClient())

  useEffect(() => {
    const fetchData = async () => {
      if (huntSource === "external") {
        try {
          const response = await fetch("/api/external/current-hunt", { cache: "no-store" })
          const payload = await response.json()
          if (response.ok && Array.isArray(payload.rows)) setAllHunts(payload.rows as BonusHunt[])
        } catch (error) {
          console.error("[v0] Error polling external hunt:", error)
        }
        return
      }

      const { data: activeHunt } = await supabaseRef.current
        .from("bonus_hunts")
        .select("starting_balance")
        .eq("id", huntId)
        .maybeSingle()
      if (activeHunt) setStartingBalance(Number(activeHunt.starting_balance ?? 0))

      const { data, error } = await supabaseRef.current
        .from("hunt_bonuses")
        .select("id, game_name, provider, bet_size, result, created_at, is_super, image_url, position")
        .eq("hunt_id", huntId)
        .order("position", { ascending: true })
      if (!error && data) {
        setAllHunts(
          data.map((bonus) => ({
            ...bonus,
            starting_balance: Number(activeHunt?.starting_balance ?? initialStartingBalance),
            opening_balance: 0,
          })) as BonusHunt[],
        )
      }

      const { data: kpiRow, error: kpiError } = await supabaseRef.current
        .from("bonus_hunt_kpis")
        .select("*")
        .eq("hunt_id", huntId)
        .maybeSingle()
      if (!kpiError && kpiRow) setKpis(kpiRow as HuntKpis)
    }
    fetchData()
    const interval = setInterval(fetchData, huntSource === "external" ? 10_000 : 1_000)
    return () => clearInterval(interval)
  }, [huntSource, huntId, initialStartingBalance])

  const hunts = allHunts
  const usingKpis = huntSource !== "external" && !!kpis
  const completed = hunts.filter((hunt) => hunt.result !== null && hunt.result > 0)
  const total = hunts.length
  const progress = total ? Math.round((completed.length / total) * 100) : 0
  const remainingCount = usingKpis ? kpis!.remaining : hunts.filter((hunt) => hunt.result === null || hunt.result === 0).length

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-xl border border-cyan-200/15 bg-slate-900/80 shadow-lg shadow-cyan-950/20">
        <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200"><span className="size-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" /> Current bonus hunt</div>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl">The hunt is moving.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Live results, real-time progress, and every bonus in one focused view.</p>
          </div>
          <div className="rounded-2xl border border-cyan-200/15 bg-slate-950/60 px-5 py-4"><p className="text-xs uppercase tracking-wider text-slate-500">Completion</p><p className="mt-1 text-3xl font-bold text-cyan-200">{completed.length}<span className="text-lg text-slate-500">/{total}</span></p></div>
        </div>
        <div className="border-t border-slate-800/80 px-5 py-5 sm:px-7"><GamesProgressBar completed={completed.length} total={total} /><div className="mt-3 flex justify-between text-xs text-slate-500"><span>{progress}% complete</span><span>{remainingCount} bonuses left</span></div></div>
      </section>

      <HuntKpiBoard
        hunts={hunts}
        kpis={usingKpis ? kpis : null}
        fallbackStartingBalance={startingBalance}
        sidePanel={
          <PredictionsLeaderboard huntId={huntId ?? ""} isLoggedIn={!!currentUsername} currentUsername={currentUsername} predictionsEnabled={true} hunts={hunts} startingBalance={usingKpis ? Number(kpis!.starting_balance) : startingBalance} />
        }
      />
    </div>
  )
}
