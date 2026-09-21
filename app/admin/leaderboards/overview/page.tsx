"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Lock, RefreshCw, Search, Trash2, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"
import { LeaderboardEntriesDialog } from "@/components/admin/leaderboard-entries-dialog"
import { DEFAULT_TIMEZONE, formatInZone, leaderboardStatus } from "@/lib/leaderboard-time"
import { paidPlaces } from "@/lib/leaderboard-payouts"
import { SelectMenu } from "@/components/ui/select-menu"

type Board = {
  id: string
  title: string
  category: string | null
  cadence: string | null
  prize_pool: number
  payout_preset: string | null
  ranking_metric: string | null
  timezone: string | null
  start_date: string
  end_date: string
  created_at: string
  finalized_at: string | null
  credited: boolean | null
  credited_at: string | null
  entryCount: number
  entryPrize: number
}

type SortKey = "created_at" | "end_date" | "prize_pool" | "entryCount"

const ALL = "all"

export default function LeaderboardsOverviewPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL)
  const [cadence, setCadence] = useState(ALL)
  const [active, setActive] = useState(ALL)
  const [credited, setCredited] = useState(ALL)
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created_at", dir: "desc" })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [entriesFor, setEntriesFor] = useState<Board | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = supabaseRef.current

    // Close anything whose window has passed before reading, so the table never
    // shows live-sorted ranks for a board that is actually over. Best-effort:
    // the nightly cron covers it anyway, and a failure here must not stop the
    // page from rendering.
    await fetch("/api/leaderboards/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due: true }),
    }).catch(() => {})

    const { data: rows, error } = await supabase
      .from("leaderboards")
      // The row rather than a column list: ranking_metric arrives with the
      // migration, and naming a column that is not there yet fails the whole
      // query rather than just that field.
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error loading leaderboards:", error)
      setLoading(false)
      return
    }

    // Counts and prize sums per board, in one query rather than one per row —
    // the old page issued a request per leaderboard and got slower with every
    // board that was ever created.
    const { data: entries, error: entriesError } = await supabase
      .from("leaderboard_entries")
      .select("leaderboard_id, prize_amount")
    if (entriesError) console.error("[v0] Error loading entry totals:", entriesError)

    const counts = new Map<string, { count: number; prize: number }>()
    for (const entry of entries ?? []) {
      const bucket = counts.get(entry.leaderboard_id) ?? { count: 0, prize: 0 }
      bucket.count += 1
      bucket.prize += Number(entry.prize_amount) || 0
      counts.set(entry.leaderboard_id, bucket)
    }

    setBoards(
      (rows ?? []).map((row) => ({
        ...row,
        entryCount: counts.get(row.id)?.count ?? 0,
        entryPrize: counts.get(row.id)?.prize ?? 0,
      })) as Board[],
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(
    () => Array.from(new Set(boards.map((board) => board.category).filter(Boolean))) as string[],
    [boards],
  )
  const cadences = useMemo(
    () => Array.from(new Set(boards.map((board) => board.cadence).filter(Boolean))) as string[],
    [boards],
  )

  const totals = useMemo(
    () => ({
      boards: boards.length,
      entries: boards.reduce((sum, board) => sum + board.entryCount, 0),
      prize: boards.reduce((sum, board) => sum + board.entryPrize, 0),
    }),
    [boards],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = boards.filter((board) => {
      const status = leaderboardStatus(board.start_date, board.end_date)
      if (category !== ALL && board.category !== category) return false
      if (cadence !== ALL && board.cadence !== cadence) return false
      if (active !== ALL && (active === "active") !== (status === "active")) return false
      if (credited !== ALL && (credited === "yes") !== !!board.credited) return false
      if (needle && !board.title.toLowerCase().includes(needle) && !board.id.toLowerCase().includes(needle)) return false
      return true
    })

    const direction = sort.dir === "asc" ? 1 : -1
    return filtered.sort((a, b) => {
      const left = sort.key === "created_at" || sort.key === "end_date" ? Date.parse(a[sort.key]) : Number(a[sort.key])
      const right = sort.key === "created_at" || sort.key === "end_date" ? Date.parse(b[sort.key]) : Number(b[sort.key])
      return (left - right) * direction
    })
  }, [boards, query, category, cadence, active, credited, sort])

  function toggleSort(key: SortKey) {
    setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }))
  }

  async function finalize(board: Board) {
    setBusy(board.id)
    const response = await fetch("/api/leaderboards/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderboardId: board.id }),
    })
    if (!response.ok) console.error("[v0] Finalise failed:", await response.text())
    setBusy(null)
    await load()
  }

  async function setCredit(board: Board, value: boolean) {
    setBusy(board.id)
    const { error } = await supabaseRef.current
      .from("leaderboards")
      .update({ credited: value, credited_at: value ? new Date().toISOString() : null })
      .eq("id", board.id)
    if (error) console.error("[v0] Could not update credited flag:", error)
    setBusy(null)
    await load()
  }

  async function deleteSelected() {
    if (selected.size === 0 || !confirm(`Delete ${selected.size} leaderboard(s) and all their entries?`)) return
    const { error } = await supabaseRef.current.from("leaderboards").delete().in("id", Array.from(selected))
    if (error) console.error("[v0] Could not delete leaderboards:", error)
    setSelected(new Set())
    await load()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Leaderboards</h1>
          <p className="mt-1 text-[13px] text-white/40">Every board, what it paid, and whether the money went out.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/leaderboards/manage"
            className="inline-flex h-9 items-center rounded-md border border-white/12 bg-white/[0.06] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
          >
            Manage
          </Link>
          <button
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Total leaderboards" value={totals.boards.toLocaleString()} />
        <StatTile label="Total entries" accent="blue" value={totals.entries.toLocaleString()} />
        <StatTile label="Total entries prize" accent="green" value={`$${totals.prize.toLocaleString()}`} />
      </div>

      {/* Filters */}
      <Panel className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Category" value={category} onChange={setCategory} options={categories} allLabel="All categories" />
          <Select label="Type" value={cadence} onChange={setCadence} options={cadences} allLabel="All types" />
          <Select
            label="Active status"
            value={active}
            onChange={setActive}
            options={["active", "inactive"]}
            allLabel="Any active status"
          />
          <Select
            label="Credited status"
            value={credited}
            onChange={setCredited}
            options={["yes", "no"]}
            optionLabels={{ yes: "Credited", no: "Not credited" }}
            allLabel="Any credited status"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or id…"
              className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </div>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-[#E5484D]/40 hover:text-[#E5484D] disabled:opacity-35 disabled:hover:border-white/[0.10] disabled:hover:text-white/50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </Panel>

      {/* Table */}
      <Panel className="overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full min-w-[1040px] border-collapse">
            <thead className="bg-[#141418]">
              <tr className="border-b border-white/[0.08] text-left">
                <th className="w-8 px-2 py-2.5" />
                <th className="w-10 px-2 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
                    onChange={() =>
                      setSelected((current) =>
                        rows.every((row) => current.has(row.id)) ? new Set() : new Set(rows.map((row) => row.id)),
                      )
                    }
                    className="h-3.5 w-3.5 accent-[#5B8DEF]"
                  />
                </th>
                <Th>Id</Th>
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Type</Th>
                <Th>Active</Th>
                <Th>Credited</Th>
                <Th sortable onClick={() => toggleSort("prize_pool")} active={sort.key === "prize_pool"} dir={sort.dir}>
                  Prize
                </Th>
                <Th sortable onClick={() => toggleSort("created_at")} active={sort.key === "created_at"} dir={sort.dir}>
                  Created
                </Th>
                <Th sortable onClick={() => toggleSort("end_date")} active={sort.key === "end_date"} dir={sort.dir}>
                  Ends at
                </Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center font-mono text-[11px] uppercase tracking-widest text-white/25">
                    Loading
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[12.5px] text-white/30">
                    No leaderboards match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((board) => {
                  const zone = board.timezone ?? DEFAULT_TIMEZONE
                  const status = leaderboardStatus(board.start_date, board.end_date)
                  const isOpen = expanded.has(board.id)
                  const needsFinalising = status === "ended" && !board.finalized_at

                  return (
                    <>
                      <tr key={board.id} className="border-b border-white/[0.05] text-[13px] hover:bg-white/[0.03]">
                        <td className="px-2 py-2">
                          <button
                            onClick={() =>
                              setExpanded((current) => {
                                const next = new Set(current)
                                next.has(board.id) ? next.delete(board.id) : next.add(board.id)
                                return next
                              })
                            }
                            aria-label={isOpen ? "Collapse" : "Expand"}
                            className="rounded p-1 text-white/25 transition hover:text-white"
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${board.title}`}
                            checked={selected.has(board.id)}
                            onChange={() =>
                              setSelected((current) => {
                                const next = new Set(current)
                                next.has(board.id) ? next.delete(board.id) : next.add(board.id)
                                return next
                              })
                            }
                            className="h-3.5 w-3.5 accent-[#5B8DEF]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <CopyableId value={board.id} />
                        </td>
                        <td className="px-3 py-2 text-white/85">{board.title}</td>
                        <td className="px-3 py-2 text-white/45">{board.category ?? "—"}</td>
                        <td className="px-3 py-2 capitalize text-white/45">{board.cadence ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Tag accent={status === "active" ? "green" : status === "upcoming" ? "amber" : "slate"}>
                            {status === "active" ? "Active" : status === "upcoming" ? "Upcoming" : "Inactive"}
                          </Tag>
                        </td>
                        <td className="px-3 py-2">
                          <Tag accent={board.credited ? "green" : "red"}>
                            {board.credited ? "Credited" : "Not credited"}
                          </Tag>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-white/70">
                          {Number(board.prize_pool).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-white/35">
                          {formatInZone(board.created_at, zone)}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-white/35">
                          {formatInZone(board.end_date, zone)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEntriesFor(board)}
                              aria-label={`Open entries for ${board.title}`}
                              title="Entries"
                              className="rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                            {needsFinalising && (
                              <button
                                onClick={() => finalize(board)}
                                disabled={busy === board.id}
                                aria-label="Finalise"
                                title="Freeze ranks and payouts"
                                className="rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-[#E8A33D] disabled:opacity-40"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${board.id}-detail`} className="border-b border-white/[0.05] bg-black/25">
                          <td colSpan={12} className="px-6 py-3">
                            <dl className="grid gap-x-8 gap-y-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
                              <Detail label="Entries" value={board.entryCount.toLocaleString()} />
                              <Detail label="Paid places" value={String(paidPlaces(board.payout_preset))} />
                              <Detail label="Prizes assigned" value={`$${board.entryPrize.toLocaleString()}`} />
                              <Detail label="Timezone" value={zone} />
                              <Detail label="Starts" value={formatInZone(board.start_date, zone)} />
                              <Detail label="Ends" value={formatInZone(board.end_date, zone)} />
                              <Detail
                                label="Finalised"
                                value={board.finalized_at ? formatInZone(board.finalized_at, zone) : "Not yet"}
                              />
                              <Detail
                                label="Credited"
                                value={board.credited_at ? formatInZone(board.credited_at, zone) : "Not yet"}
                              />
                            </dl>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => setEntriesFor(board)}
                                className="rounded-md border border-white/12 bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
                              >
                                View entries
                              </button>
                              <button
                                onClick={() => finalize(board)}
                                disabled={busy === board.id || !!board.finalized_at}
                                className="rounded-md border border-white/[0.10] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-35"
                              >
                                {board.finalized_at ? "Finalised" : "Finalise now"}
                              </button>
                              <button
                                onClick={() => setCredit(board, !board.credited)}
                                disabled={busy === board.id}
                                className="rounded-md border border-white/[0.10] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-35"
                              >
                                {board.credited ? "Mark not credited" : "Mark credited"}
                              </button>
                              <button
                                onClick={() => router.push("/admin/leaderboards/manage")}
                                className="rounded-md border border-white/[0.10] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
                              >
                                Edit board
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {entriesFor && (
        <LeaderboardEntriesDialog
          leaderboard={{
            id: entriesFor.id,
            title: entriesFor.title,
            prize_pool: Number(entriesFor.prize_pool),
            payout_preset: entriesFor.payout_preset,
            ranking_metric: entriesFor.ranking_metric,
            finalized_at: entriesFor.finalized_at,
          }}
          onClose={() => {
            setEntriesFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function Th({
  children,
  sortable,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode
  sortable?: boolean
  onClick?: () => void
  active?: boolean
  dir?: "asc" | "desc"
}) {
  return (
    <th className="px-3 py-2.5 font-normal">
      {sortable ? (
        <button onClick={onClick} className="inline-flex items-center gap-1 transition hover:opacity-100">
          <MonoLabel className={active ? "text-white/70" : "text-white/30"}>{children}</MonoLabel>
          {active && <span className="text-[9px] text-white/50">{dir === "asc" ? "↑" : "↓"}</span>}
        </button>
      ) : (
        <MonoLabel className="text-white/30">{children}</MonoLabel>
      )}
    </th>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MonoLabel className="block text-white/25">{label}</MonoLabel>
      <dd className="mt-0.5 text-white/70">{value}</dd>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  allLabel,
  optionLabels,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  allLabel: string
  optionLabels?: Record<string, string>
}) {
  return (
    <label className="block">
      <MonoLabel className="block text-white/30">{label}</MonoLabel>
      <div className="mt-1">
        <SelectMenu
          aria-label={allLabel}
          value={value}
          onChange={onChange}
          options={[
            { value: ALL, label: allLabel },
            ...options.map((option) => ({ value: option, label: optionLabels?.[option] ?? option })),
          ]}
        />
      </div>
    </label>
  )
}
