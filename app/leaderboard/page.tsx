"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Crown, Trophy, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { rankEntries } from "@/lib/leaderboard-payouts"
import { DEFAULT_TIMEZONE, formatInZone, leaderboardStatus } from "@/lib/leaderboard-time"

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

const money = (value: number) => "$" + Math.round(Number(value) || 0).toLocaleString("en-US")
const PLACES = ["#E8C547", "#B9C0CC", "#C08552"]

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

  const ranked = useMemo(() => {
    if (!board) return []
    return rankEntries(entries, Number(board.prize_pool) || 0, board.payout_preset ?? board.prize_distribution_type)
  }, [entries, board])

  const totalWagered = ranked.reduce((sum, entry) => sum + (Number(entry.wager_amount) || 0), 0)

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16 text-center">
        <MonoLabel className="text-white/25">Loading</MonoLabel>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-6">
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
      <div className="mx-auto max-w-5xl px-5 py-6">
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
    <div className="mx-auto max-w-5xl space-y-4 px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{board.title}</h1>
          {board.subtitle && <p className="mt-1 text-[13px] text-white/40">{board.subtitle}</p>}
        </div>

        {boards.length > 1 && (
          <select
            value={selected ?? ""}
            onChange={(event) => setSelected(event.target.value)}
            className="h-9 rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none focus:border-white/25"
          >
            {boards.map((entry) => (
              <option key={entry.id} value={entry.id} className="bg-[#121216]">
                {entry.title}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="grid gap-2.5 sm:grid-cols-4">
        <StatTile label="Prize pool" value={money(board.prize_pool)} accent="amber" />
        <StatTile label="Players" value={ranked.length.toLocaleString()} accent="blue" />
        <StatTile label="Total wagered" value={money(totalWagered)} accent="green" />
        <StatTile
          label={countdown.over ? "Closed" : "Time left"}
          value={
            countdown.over
              ? "—"
              : countdown.days > 0
                ? `${countdown.days}d ${countdown.hours}h`
                : `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`
          }
          hint={`Ends ${formatInZone(board.end_date, zone)}`}
        />
      </div>

      <Panel accent="amber">
        <PanelHeader
          title="Standings"
          accent="amber"
          right={<Tag accent="green">Live</Tag>}
        />
        {ranked.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Users className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">No entries yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {ranked.map((entry) => {
              const place = entry.rank <= 3 ? PLACES[entry.rank - 1] : null
              return (
                <li key={entry.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold tabular-nums"
                    style={
                      place
                        ? { backgroundColor: place, color: "#0B0B0D" }
                        : { color: "rgba(255,255,255,0.25)" }
                    }
                  >
                    {entry.rank}
                  </span>

                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full border border-white/[0.08] object-cover"
                    />
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03]" />
                  )}

                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
                    {entry.username}
                  </span>

                  {entry.rank === 1 && <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: PLACES[0] }} />}

                  <span className="w-28 shrink-0 text-right text-[13px] tabular-nums text-white/60">
                    {money(entry.wager_amount)}
                  </span>
                  <span
                    className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums"
                    style={{ color: entry.prize_amount > 0 ? ACCENTS.green : "rgba(255,255,255,0.15)" }}
                  >
                    {entry.prize_amount > 0 ? money(entry.prize_amount) : "—"}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-white/[0.08] px-3.5 py-2">
          <MonoLabel className="text-white/25">Wagers update as they come in</MonoLabel>
          <MonoLabel className="text-white/25">{formatInZone(board.start_date, zone)} — {formatInZone(board.end_date, zone)}</MonoLabel>
        </div>
      </Panel>
    </div>
  )
}
