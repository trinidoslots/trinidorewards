"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, Trophy } from "lucide-react"
import { MonoLabel } from "@/components/ui/panel"
import { createClient } from "@/lib/supabase/client"
import { rankEntries } from "@/lib/leaderboard-payouts"
import { DEFAULT_TIMEZONE, formatInZone, leaderboardStatus } from "@/lib/leaderboard-time"
import { moneyExact } from "@/lib/leaderboard-format"
import { BoardHero, StandingsTable, type RankedEntry } from "@/components/leaderboard-board"
import { Swap } from "@/components/swap"
import { entryAmounts, metricLabel, readMetric } from "@/lib/leaderboard-metric"
import { maskUsername } from "@/lib/leaderboard-mask"
import { PageBody, PageHero } from "@/components/page-hero"

/**
 * The public leaderboard.
 *
 * Standings are ranked here from the wagers rather than read from the stored
 * rank column: rank is only written when a board is finalised, so a live board
 * has it null on every row and the list came out in whatever order the database
 * felt like.
 *
 * Two kinds of board feed this page. A 'csv' board's rows were imported by the
 * admin and live in leaderboard_entries. An 'api' board has no rows of its own:
 * its standings come from /api/leaderboards/standings, which calls the external
 * feed server-side. Both arrive in the same shape, so everything below the
 * fetch is unaware of the difference.
 */

type Entry = {
  id: string
  username: string
  avatar_url: string | null
  total_wagered: number
  total_earned: number
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
  ranking_metric?: string | null
  source?: string | null
}

/** One row of /api/leaderboards/standings. */
type Standing = { rank: number; username: string; avatar: string | null; score: number }

/**
 * Exactly the columns this page renders.
 *
 * It used to ask for "*", which also fetched the board's stored provider
 * credentials into every visitor's browser. Naming the columns is what keeps
 * them out; the fields themselves are dropped in scripts/059.
 */
const BOARD_COLUMNS =
  "id, title, subtitle, prize_pool, start_date, end_date, payout_preset, prize_distribution_type, timezone, ranking_metric, source"

/** Same again for the rows: user_ref is an external account id and stays server-side. */
const ENTRY_COLUMNS = "id, username, avatar_url, prize_amount, total_wagered, total_earned"

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
  const [query, setQuery] = useState("")
  /**
   * The board whose entries are actually in `entries`.
   *
   * Clicking a board used to clear the table and start a height animation
   * immediately, then start a second one when the fetch landed — a blank
   * flash and two reflows for one click. Holding the previous board until its
   * replacement has arrived means one switch, with the right numbers and the
   * right final height, animated once.
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /**
   * Why the standings are missing, when they are.
   *
   * An empty table used to say "No entries yet" whether the board was genuinely
   * empty or the feed had just refused the request — the one case where the
   * visitor should be told to come back rather than assume nobody has played.
   */
  const [entriesError, setEntriesError] = useState<string | null>(null)

  // What is on screen, which lags the click by exactly one fetch.
  const shownId = loadedFor ?? selected
  const board = boards.find((entry) => entry.id === shownId) ?? null

  // Where the selected board's standings come from. Read as a plain string
  // rather than depending on `boards`, so the fetch effect below re-runs when
  // the choice changes and not every time the board list is replaced.
  const selectedSource = boards.find((entry) => entry.id === selected)?.source ?? null
  const countdown = useCountdown(board?.end_date)
  const zone = board?.timezone || DEFAULT_TIMEZONE

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: problem } = await supabaseRef.current
      .from("leaderboards")
      .select(BOARD_COLUMNS)
      .order("created_at", { ascending: false })

    if (problem) {
      console.error("[v0] Error fetching leaderboards:", problem)
      // The Postgres message names columns and policies. The page says what
      // happened; the detail stays in the console.
      setError("The leaderboards could not be loaded.")
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

    // The request belonging to a board that is no longer selected must not be
    // allowed to write its rows: clicking twice quickly used to leave whichever
    // response happened to land second on screen.
    const settle = (rows: Entry[], problem: string | null) => {
      if (cancelled) return
      setEntries(rows)
      setEntriesError(problem)
      // Rows and identity land in the same commit, so the swap animates once,
      // against content that is already final.
      setLoadedFor(selected)
    }

    ;(async () => {
      if (selectedSource === "api") {
        try {
          const response = await fetch(`/api/leaderboards/standings?boardId=${encodeURIComponent(selected)}`, {
            signal: AbortSignal.timeout(15_000),
          })
          const payload = (await response.json().catch(() => null)) as
            | { standings?: Standing[]; error?: string }
            | null

          if (!response.ok) {
            settle([], payload?.error || "The standings are not available right now.")
            return
          }

          settle(
            (payload?.standings ?? []).map((row) => ({
              // No database row behind these, so the key is the board and the
              // place — stable for as long as the row holds that place.
              id: `${selected}:${row.rank}`,
              // Already masked server-side; masking here too would only mask a
              // mask.
              username: row.username,
              avatar_url: row.avatar,
              // rankEntries works the prize out from the pool and the preset,
              // the same way it does for an imported board.
              prize_amount: 0,
              total_wagered: row.score,
              total_earned: 0,
            })),
            null,
          )
        } catch (problem) {
          if (cancelled) return
          console.error("[leaderboard] standings request failed:", problem)
          settle([], "The standings could not be reached.")
        }
        return
      }

      const { data, error: problem } = await supabaseRef.current
        .from("leaderboard_entries")
        .select(ENTRY_COLUMNS)
        .eq("leaderboard_id", selected)

      if (problem) {
        console.error("[v0] Error fetching entries:", problem)
        settle([], "The standings could not be loaded.")
        return
      }

      settle(
        (data ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          username: maskUsername(String(row.username ?? "")),
          avatar_url: (row.avatar_url as string | null) ?? null,
          prize_amount: Number(row.prize_amount) || 0,
          ...entryAmounts(row),
        })),
        null,
      )
    })()

    return () => {
      cancelled = true
    }
  }, [selected, selectedSource])

  // The external feed is a wager leaderboard and reports one number, so an
  // API board is ranked on wagers whatever the admin picked. Honouring 'earned'
  // here would rank every player on a column nothing fills, i.e. on zero.
  const metric = readMetric(board?.source === "api" ? "wagered" : board?.ranking_metric)

  const ranked = useMemo<RankedEntry[]>(() => {
    if (!board) return []
    return rankEntries(
      entries,
      Number(board.prize_pool) || 0,
      board.payout_preset ?? board.prize_distribution_type,
      metric,
    )
  }, [entries, board, metric])

  const podium = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const totalWagered = ranked.reduce((sum, entry) => sum + entry.total_wagered, 0)
  const totalEarned = ranked.reduce((sum, entry) => sum + entry.total_earned, 0)


  // Search filters the table, never the podium: the top three are the
  // headline of the board, not a result set.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rest
    return rest.filter((entry) => entry.username.toLowerCase().includes(needle))
  }, [rest, query])

  if (loading) {
    return (
      <div>
        <PageHero accent="amber" title="Leaderboard" subtitle="Loading the current board." />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHero accent="amber" title="Leaderboard" />
        <PageBody className="max-w-3xl">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
            <Trophy className="mx-auto h-8 w-8 text-white/15" />
            <p className="mt-3 text-[14px] text-white">{error}</p>
            <p className="mt-1 text-[12.5px] text-white/35">Try again in a moment.</p>
          </div>
        </PageBody>
      </div>
    )
  }

  if (!board) {
    return (
      <div>
        <PageHero accent="amber" title="Leaderboard" subtitle="Nothing running at the moment." />
        <PageBody className="max-w-3xl">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] py-16">
            <Trophy className="h-8 w-8 text-white/10" />
            <p className="text-[13px] text-white/30">Check back when the next board opens.</p>
          </div>
        </PageBody>
      </div>
    )
  }

  const zoneRange = `${formatInZone(board.start_date, zone)} — ${formatInZone(board.end_date, zone)}`

  return (
    <div className="pb-10">
      <BoardHero
        // The click starts the exit; the fetch releases the entry. Keyed on
        // the clicked board rather than the shown one so nothing sits still
        // for the length of a round trip.
        swapKey={selected ?? board.id}
        swapReady={loadedFor === selected}
        prizePool={board.prize_pool}
        title={board.title}
        subtitle={board.subtitle}
        metric={metric}
        podium={podium}
        countdown={countdown}
        range={zoneRange}
        switcher={
          // Several live boards become a segmented switch rather than a
          // dropdown: with two or three of them the choices are worth seeing.
          boards.length > 1 ? (
            <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-white/[0.08] bg-black/40 p-1">
              {boards.map((entry) => {
                const active = entry.id === selected
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelected(entry.id)}
                    className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition"
                    style={
                      active
                        ? { backgroundColor: "rgba(255,255,255,0.10)", color: "#fff" }
                        : { color: "rgba(255,255,255,0.4)" }
                    }
                  >
                    {entry.title}
                  </button>
                )
              })}
            </div>
          ) : undefined
        }
      />

      <div className="mx-auto mt-8 max-w-4xl space-y-3 px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players…"
              aria-label="Search players"
              className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Stat label="Players" value={ranked.length.toLocaleString("en-US")} />
            <Stat
              label={`Total ${metricLabel(metric).toLowerCase()}`}
              value={moneyExact(metric === "earned" ? totalEarned : totalWagered)}
            />
          </div>
        </div>

        <Swap on={`${selected}:${metric}`} ready={loadedFor === selected}>
          <StandingsTable
            rows={filtered}
            metric={metric}
            emptyNote={
              // A feed that refused says so. Reporting that as "no entries yet"
              // tells the visitor nobody is playing, which is a different and
              // wrong thing.
              entriesError
                ? entriesError
                : ranked.length === 0
                  ? "No entries yet."
                  : query.trim()
                    ? "Nobody by that name."
                    : "Only the podium so far."
            }
          />
        </Swap>

        <p className="text-center text-[11.5px] text-white/20">Wagers update as they come in</p>
      </div>
    </div>
  )
}

/** A figure with its caption, sized to sit next to the search field. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-right">
      <p className="text-[13px] font-semibold leading-none tabular-nums text-white">{value}</p>
      <MonoLabel className="mt-1 block text-white/25">{label}</MonoLabel>
    </div>
  )
}
