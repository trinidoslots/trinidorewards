"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Plus, RefreshCw, Search, Trash2, Trophy, Undo2, UserRound } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"
import { RecordWinDialog } from "@/components/admin/record-win-dialog"
import { WIN_SOURCES, sourceMeta, winValue, type WinLog } from "@/lib/wins"

/**
 * Every win, from everywhere.
 *
 * Both a record and a to-do list: status separates "they won this" from "we
 * have paid it", because the first is a fact the moment it happens and the
 * second is a job someone still has to do.
 */

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

export default function AdminWinsPage() {
  const [wins, setWins] = useState<WinLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [source, setSource] = useState("all")
  const [status, setStatus] = useState("all")
  const [adding, setAdding] = useState(false)
  const [manualName, setManualName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/wins", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Could not load the winner log")
      setWins((payload.wins ?? []) as WinLog[])
      setError(null)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load the winner log")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return wins.filter((win) => {
      if (source !== "all" && win.source !== source) return false
      if (status !== "all" && win.status !== status) return false
      if (!needle) return true
      return (
        win.username.toLowerCase().includes(needle) ||
        win.prize.toLowerCase().includes(needle) ||
        (win.note ?? "").toLowerCase().includes(needle)
      )
    })
  }, [wins, query, source, status])

  const totals = useMemo(
    () => ({
      wins: wins.length,
      pending: wins.filter((win) => win.status !== "paid").length,
      cash: wins.reduce((sum, win) => sum + (Number(win.amount) || 0), 0),
    }),
    [wins],
  )

  async function setPaid(win: WinLog, paid: boolean) {
    const response = await fetch("/api/admin/wins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: win.id, status: paid ? "paid" : "pending" }),
    })
    if (!response.ok) {
      setError("Could not update that win")
      return
    }
    const payload = await response.json()
    setWins((current) => current.map((entry) => (entry.id === win.id ? (payload.win as WinLog) : entry)))
  }

  async function remove(win: WinLog) {
    if (!confirm(`Delete the ${win.prize} win for ${win.username}?`)) return
    const response = await fetch(`/api/admin/wins?id=${win.id}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Could not delete that win")
      return
    }
    setWins((current) => current.filter((entry) => entry.id !== win.id))
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Winner log</h1>
          <p className="mt-1 text-[13px] text-white/40">Every giveaway, prediction and battle win, and whether it went out.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const name = prompt("Username of the winner")?.trim()
              if (!name) return
              setManualName(name)
              setAdding(true)
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
          >
            <Plus className="h-3.5 w-3.5" />
            Record a win
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Wins recorded" value={totals.wins.toLocaleString()} />
        <StatTile label="Waiting to be paid" value={totals.pending.toLocaleString()} accent="amber" />
        <StatTile
          label="Cash value awarded"
          value={`$${Math.round(totals.cash).toLocaleString("en-US")}`}
          accent="green"
        />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search winner, prize, note…"
              className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </div>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="h-9 rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none focus:border-white/25"
          >
            <option value="all" className="bg-[#121216]">All sources</option>
            {WIN_SOURCES.map((entry) => (
              <option key={entry.id} value={entry.id} className="bg-[#121216]">
                {entry.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none focus:border-white/25"
          >
            <option value="all" className="bg-[#121216]">Any status</option>
            <option value="pending" className="bg-[#121216]">Not paid</option>
            <option value="paid" className="bg-[#121216]">Paid</option>
          </select>
          <MonoLabel className="text-white/25">
            {rows.length} {rows.length === 1 ? "win" : "wins"}
          </MonoLabel>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Trophy className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">
              {wins.length === 0 ? "Nothing recorded yet." : "No wins match those filters."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {rows.map((win) => {
              const meta = sourceMeta(win.source)
              const paid = win.status === "paid"
              return (
                <li key={win.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
                  <Tag accent={meta.accent}>{meta.label}</Tag>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      {win.user_id ? (
                        <Link
                          href={`/admin/users/${win.user_id}`}
                          className="truncate text-[13px] font-medium text-white underline-offset-4 hover:underline"
                        >
                          {win.username}
                        </Link>
                      ) : (
                        <span className="flex items-baseline gap-1.5">
                          <span className="truncate text-[13px] font-medium text-white/70">{win.username}</span>
                          {/* Worth surfacing: nobody to pay through the site. */}
                          <MonoLabel className="text-white/20">No account</MonoLabel>
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-white/30">
                      {win.prize}
                      {win.source_ref ? ` · ${win.source_ref}` : ""}
                      {win.note ? ` · ${win.note}` : ""}
                    </p>
                  </div>

                  <span className="shrink-0 text-[13px] tabular-nums" style={{ color: ACCENTS.green }}>
                    {winValue(win)}
                  </span>

                  <MonoLabel className="w-36 shrink-0 text-right text-white/20">{when(win.created_at)}</MonoLabel>

                  <button
                    type="button"
                    onClick={() => setPaid(win, !paid)}
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition"
                    style={
                      paid
                        ? { borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }
                        : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.4)" }
                    }
                  >
                    {paid ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {paid ? "Paid" : "Mark paid"}
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(win)}
                    aria-label={`Delete win for ${win.username}`}
                    className="shrink-0 rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {adding && manualName && (
        <RecordWinDialog
          username={manualName}
          source="manual"
          onClose={() => {
            setAdding(false)
            setManualName("")
          }}
          onSaved={load}
        />
      )}
    </div>
  )
}
