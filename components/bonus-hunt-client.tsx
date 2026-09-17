"use client"

import { useEffect, useRef, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { HuntKpis } from "@/lib/active-hunt"
import { GamesProgressBar } from "@/components/games-progress-bar"
import { PredictionsLeaderboard } from "@/components/predictions-leaderboard"
import { HuntKpiBoard } from "@/components/hunt-kpi-board"
import { MonoLabel, Panel } from "@/components/ui/panel"

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
    <div className="flex flex-col gap-2.5">
      {/* Progress only — the page header above already names the page, so a
          second hero here was two titles stacked on one screen. */}
      <Panel className="px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <MonoLabel className="text-white/35">Opened</MonoLabel>
          <p className="text-[13px] tabular-nums text-white/45">
            <span className="text-[20px] font-semibold text-white">{completed.length}</span>
            <span className="text-white/30"> / {total}</span>
          </p>
        </div>
        <GamesProgressBar completed={completed.length} total={total} />
        <div className="mt-2.5 flex justify-between">
          <MonoLabel className="text-white/25">{progress}% complete</MonoLabel>
          <MonoLabel className="text-white/25">{remainingCount} left</MonoLabel>
        </div>
      </Panel>

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
