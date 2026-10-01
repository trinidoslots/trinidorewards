"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ALL_OFF, readModules, type ModuleStatus } from "@/lib/site-modules"
import { stateOf, streamState, type ScheduleEntry, type StreamState } from "@/lib/schedule"
import { readMetric } from "@/lib/leaderboard-metric"
import { maskUsername } from "@/lib/leaderboard-mask"
import { winValue } from "@/lib/wins"
import type { HuntSnapshot } from "@/lib/landing"

/**
 * Everything the landing page reads, in one place.
 *
 * Lifted out of app/page.tsx unchanged in substance so the page can be about
 * layout. Each block is still loaded on its own and allowed to fail on its own:
 * a landing page that renders nothing because one table was unreachable is
 * worse than one that renders four fifths of itself.
 */

export type LandingBoard = { id: string; title: string; pool: number; endsAt: string; metric: string; top: string[] }
export type LandingRaffle = { id: string; title: string; prize: string | null; endsAt: string | null; tickets: number }
export type LandingWin = { id: string; username: string; prize: string }

export type LandingData = {
  givenAway: number | null
  modules: ModuleStatus
  stream: StreamState
  /** The next few scheduled streams, soonest first, for the "coming up" strip. */
  upcoming: ScheduleEntry[]
  hunt: HuntSnapshot | null
  board: LandingBoard | null
  raffle: LandingRaffle | null
  wins: LandingWin[]
}

export function useLandingData(): LandingData {
  const supabaseRef = useRef(createClient())
  const [givenAway, setGivenAway] = useState<number | null>(null)
  const [modules, setModules] = useState<ModuleStatus>(ALL_OFF)
  const [stream, setStream] = useState<StreamState>({ kind: "none" })
  const [upcoming, setUpcoming] = useState<ScheduleEntry[]>([])
  const [hunt, setHunt] = useState<HuntSnapshot | null>(null)
  const [board, setBoard] = useState<LandingBoard | null>(null)
  const [raffle, setRaffle] = useState<LandingRaffle | null>(null)
  const [wins, setWins] = useState<LandingWin[]>([])

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    const safely = async <T,>(what: string, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run()
      } catch (error) {
        console.log(`[v0] landing: ${what} unavailable`, error)
        return null
      }
    }

    void (async () => {
      const [settings, moduleRows, schedule] = await Promise.all([
        safely("settings", async () =>
          (await supabase.from("settings").select("value").eq("key", "total_given_away").maybeSingle()).data),
        safely("modules", async () =>
          (await supabase.from("modules").select("module_name, is_enabled")).data),
        safely("schedule", async () =>
          (await supabase
            .from("stream_schedule")
            .select("*")
            .gte("starts_at", new Date(Date.now() - 6 * 3600_000).toISOString())
            .order("starts_at", { ascending: true })
            .limit(20)).data),
      ])
      if (cancelled) return

      const parsed = Number.parseInt(settings?.value ?? "", 10)
      if (Number.isFinite(parsed)) setGivenAway(parsed)
      if (moduleRows) setModules(readModules(moduleRows))
      if (schedule) {
        const entries = schedule as ScheduleEntry[]
        setStream(streamState(entries))
        // The same filter streamState applies, so the strip never lists a
        // cancelled stream or a day off as something to tune in for.
        setUpcoming(
          entries
            .filter((entry) => !entry.is_day_off && !entry.is_cancelled && stateOf(entry) === "upcoming")
            .slice(0, 4),
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // The live blocks. Kept out of the first effect so a slow leaderboard never
  // holds up the hero, which is the part that has to be there immediately.
  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    void (async () => {
      // --- the running hunt -------------------------------------------------
      try {
        const { data } = await supabase
          .from("bonus_hunt_kpis")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!cancelled && data) {
          setHunt({
            openedBonuses: Number(data.opened_bonuses) || 0,
            totalBonuses: Number(data.total_bonuses) || 0,
            startingBalance: Number(data.starting_balance) || 0,
            currentBalance: Number(data.current_balance) || 0,
            bestMultiplier: Number(data.best_multiplier) || 0,
            bestMultiplierGame: data.best_multiplier_game ?? null,
          })
        }
      } catch (error) {
        console.log("[v0] landing: hunt unavailable", error)
      }

      // --- the running leaderboard, and its top three -----------------------
      try {
        const { data: boards } = await supabase
          .from("leaderboards")
          // Named columns, not "*": the row also carried the board's stored
          // provider credentials, and this runs in the browser.
          .select("id, title, prize_pool, start_date, end_date, ranking_metric, source")
          .order("created_at", { ascending: false })
          .limit(6)

        const now = Date.now()
        const live = (boards ?? []).find(
          (row: any) => Date.parse(row.start_date) <= now && now < Date.parse(row.end_date),
        )

        if (live && !cancelled) {
          // An API board is ranked on wagers whatever is stored: the feed
          // reports one number and it is not earnings.
          const metric = readMetric(live.source === "api" ? "wagered" : live.ranking_metric)
          const column = metric === "earned" ? "total_earned" : "total_wagered"
          // Ordering in the database rather than reading the whole field to
          // show three names. If the column is not there yet — 054 unrun — the
          // card still has its pool and simply has no podium. An API board's
          // rows are put here by the sync job, so both kinds read the same way.
          const { data: rows } = await supabase
            .from("leaderboard_entries")
            .select("username")
            .eq("leaderboard_id", live.id)
            .order(column, { ascending: false })
            .limit(3)

          let top = (rows ?? []).map((row: any) => maskUsername(String(row.username)))

          // A board the sync job has not reached yet would show a pool with
          // nobody under it.
          if (top.length === 0 && live.source === "api") {
            const response = await fetch(`/api/leaderboards/standings?boardId=${encodeURIComponent(live.id)}`)
            if (response.ok) {
              const payload = (await response.json()) as { standings?: { username: string }[] }
              top = (payload.standings ?? []).slice(0, 3).map((row) => row.username)
            }
          }

          if (!cancelled) {
            setBoard({
              id: live.id,
              title: live.title,
              pool: Number(live.prize_pool) || 0,
              endsAt: live.end_date,
              metric,
              top,
            })
          }
        }
      } catch (error) {
        console.log("[v0] landing: leaderboard unavailable", error)
      }

      // --- a running raffle -------------------------------------------------
      try {
        const { data } = await supabase
          .from("raffles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(8)

        const now = Date.now()
        const live = (data ?? []).find(
          (row: any) =>
            !row.is_hidden &&
            !row.winner_username &&
            (!row.end_date || Date.parse(row.end_date) > now),
        )
        if (live && !cancelled) {
          setRaffle({
            id: live.id,
            title: live.title,
            prize: live.prize ?? live.prize_description ?? null,
            endsAt: live.end_date ?? null,
            tickets: Number(live.tickets_sold) || 0,
          })
        }
      } catch (error) {
        console.log("[v0] landing: raffles unavailable", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // --- recent winners, for the ticker ---------------------------------------
  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from("win_logs")
          .select("id, username, prize, amount, points, source")
          .order("created_at", { ascending: false })
          .limit(12)
        if (cancelled || !data) return
        setWins(
          data
            .map((row: any) => ({
              id: String(row.id),
              username: String(row.username ?? "Anonymous"),
              prize: winValue(row) === "—" ? String(row.prize ?? "") : winValue(row),
            }))
            .filter((win) => win.prize),
        )
      } catch (error) {
        console.log("[v0] landing: winners unavailable", error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { givenAway, modules, stream, upcoming, hunt, board, raffle, wins }
}

/**
 * One ticking clock for every countdown on the page, rather than one each.
 * Returns the current time so callers pass it to countdownTo explicitly.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
