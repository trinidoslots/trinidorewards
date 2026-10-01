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
    // Nothing to follow: an integrated hunt with no active row would poll
    // three queries a second for an id of null.
    if (huntSource !== "external" && !huntId) return

    // One round at a time. At a one-second interval a slow connection would
    // otherwise start the next round before the last one landed, and the
    // requests pile up — on exactly the connections that can least afford it.
    let inFlight = false
    const tick = async () => {
      // A background tab is not watching; it catches up on the next tick
      // after it comes back.
      if (inFlight || document.hidden) return
      inFlight = true
      try {
        await fetchData()
      } finally {
        inFlight = false
      }
    }

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

      // The three reads are independent, so they go out together: one round
      // trip's wait per tick instead of three.
      const [{ data: activeHunt }, { data, error }, { data: kpiRow, error: kpiError }] = await Promise.all([
        supabaseRef.current.from("bonus_hunts").select("starting_balance").eq("id", huntId).maybeSingle(),
        supabaseRef.current
          .from("hunt_bonuses")
          .select("id, game_name, provider, bet_size, result, created_at, is_super, image_url, position")
          .eq("hunt_id", huntId)
          .order("position", { ascending: true }),
        supabaseRef.current.from("bonus_hunt_kpis").select("*").eq("hunt_id", huntId).maybeSingle(),
      ])
      if (activeHunt) setStartingBalance(Number(activeHunt.starting_balance ?? 0))

      if (!error && data) {
        setAllHunts(
          data.map((bonus) => ({
            ...bonus,
            starting_balance: Number(activeHunt?.starting_balance ?? initialStartingBalance),
            opening_balance: 0,
          })) as BonusHunt[],
        )
      }
      if (!kpiError && kpiRow) setKpis(kpiRow as HuntKpis)
    }
    // No fetch on mount: the server rendered this a moment ago with the same
    // three reads, and repeating them immediately was pure duplicate load
    // during the page's busiest second. The first tick refreshes it.
    const interval = setInterval(tick, huntSource === "external" ? 10_000 : 1_000)
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
