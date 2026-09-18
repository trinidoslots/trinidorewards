"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Trophy, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { MonoLabel, Panel, PanelHeader, Tag } from "@/components/ui/panel"
import { rankEntries } from "@/lib/leaderboard-payouts"
import { DEFAULT_TIMEZONE, formatInZone, leaderboardStatus } from "@/lib/leaderboard-time"
import { countdownLabel, money, moneyExact } from "@/lib/leaderboard-format"
import { BoardHero, RankRow, type RankedEntry } from "@/components/leaderboard-board"

/**
 * The public leaderboard.
 *
 * Standings are ranked here from the wagers rather than read from the stored
 * rank column: rank is only written when a board is finalised, so a live board
 * has it null on every row and the list came out in whatever order the database
 * felt like.
 */

type Entry = {
  id: string
  username: string
  avatar_url: string | null
  wager_amount: number
  prize_amount: number
}

type Leaderboard = {
  id: string
  title: string
  subtitle: string | null
  prize_pool: number
  start_date: string
  end_date: string
  payout_preset?: string | null
  prize_distribution_type?: string | null
  timezone?: string | null
}

function useCountdown(endDate: string | undefined) {
  const [left, setLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, over: true })

  useEffect(() => {
    if (!endDate) return
    const tick = () => {
      const diff = new Date(endDate).getTime() - Date.now()
      if (diff <= 0) {
        setLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, over: true })
        return
      }
      setLeft({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1000),
        over: false,
      })
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [endDate])

  return left
}

export default function LeaderboardPage() {
  const supabaseRef = useRef(createClient())

  const [boards, setBoards] = useState<Leaderboard[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const board = boards.find((entry) => entry.id === selected) ?? null
  const countdown = useCountdown(board?.end_date)
  const zone = board?.timezone || DEFAULT_TIMEZONE

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: problem } = await supabaseRef.current
      .from("leaderboards")
      .select("*")
      .order("created_at", { ascending: false })

    if (problem) {
      console.error("[v0] Error fetching leaderboards:", problem)
      setError(problem.message || "Could not load the leaderboards")
      setLoading(false)
      return
    }

    const live = ((data ?? []) as Leaderboard[]).filter(
      (entry) => leaderboardStatus(entry.start_date, entry.end_date) === "active",
    )
    setBoards(live)
    setSelected((current) => current ?? live[0]?.id ?? null)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      const { data, error: problem } = await supabaseRef.current
        .from("leaderboard_entries")
        .select("id, username, avatar_url, wager_amount, prize_amount")
        .eq("leaderboard_id", selected)

      if (cancelled) return
      if (problem) {
        console.error("[v0] Error fetching entries:", problem)
        setEntries([])
        return
      }
      setEntries((data ?? []) as Entry[])
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  const ranked = useMemo<RankedEntry[]>(() => {
    if (!board) return []
    return rankEntries(entries, Number(board.prize_pool) || 0, board.payout_preset ?? board.prize_distribution_type)
  }, [entries, board])

  const podium = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const totalWagered = ranked.reduce((sum, entry) => sum + (Number(entry.wager_amount) || 0), 0)

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <MonoLabel className="text-white/25">Loading</MonoLabel>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-6">
        <Panel accent="red" className="p-6 text-center">
          <Trophy className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-[14px] text-white">The leaderboard could not be loaded.</p>
          <p className="mt-1 text-[12.5px] text-white/35">{error}</p>
        </Panel>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Leaderboard</h1>
        </header>
        <Panel className="flex flex-col items-center gap-2 py-16">
          <Trophy className="h-8 w-8 text-white/10" />
          <p className="text-[13px] text-white/30">No leaderboard is running right now.</p>
        </Panel>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-5 py-6">
      {boards.length > 1 && (
        <div className="flex justify-end">
          <select
            value={selected ?? ""}
            onChange={(event) => setSelected(event.target.value)}
            aria-label="Choose a leaderboard"
            className="h-9 rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none focus:border-white/25"
          >
            {boards.map((entry) => (
              <option key={entry.id} value={entry.id} className="bg-[#121216]">
                {entry.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <BoardHero
        prizePool={board.prize_pool}
        title={board.title}
        subtitle={board.subtitle}
        countdown={countdownLabel(countdown)}
        podium={podium}
      />

      {ranked.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 py-16">
          <Users className="h-7 w-7 text-white/10" />
          <p className="text-[13px] text-white/30">No entries yet.</p>
        </Panel>
      ) : (
        rest.length > 0 && (
          <Panel>
            <PanelHeader title="The chase" right={<Tag accent="green">Live</Tag>} />
            <ul className="divide-y divide-white/[0.05]">
              {rest.map((entry) => (
                <RankRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </Panel>
        )
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Panel className="px-3.5 py-3">
          <p className="text-[17px] font-semibold leading-none tabular-nums text-white">
            {ranked.length.toLocaleString("en-US")}
          </p>
          <MonoLabel className="mt-1.5 block text-white/30">Players</MonoLabel>
        </Panel>
        <Panel className="px-3.5 py-3">
          <p className="text-[17px] font-semibold leading-none tabular-nums text-white">{moneyExact(totalWagered)}</p>
          <MonoLabel className="mt-1.5 block text-white/30">Total wagered</MonoLabel>
        </Panel>
        <Panel className="col-span-2 px-3.5 py-3 sm:col-span-1">
          <p className="text-[13px] leading-none text-white/70">{formatInZone(board.end_date, zone)}</p>
          <MonoLabel className="mt-1.5 block text-white/30">Closes</MonoLabel>
        </Panel>
      </div>

      <p className="text-center text-[11.5px] text-white/20">
        Wagers update as they come in · {formatInZone(board.start_date, zone)} — {formatInZone(board.end_date, zone)}
      </p>
    </div>
  )
}
