"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"
import { prizeFor } from "@/lib/leaderboard-payouts"

export type EntryRow = {
  id: string
  rank: number
  username: string
  user_ref: string | null
  wager_amount: number
  prize_amount: number
}

type Props = {
  leaderboard: { id: string; title: string; prize_pool: number; payout_preset: string | null; finalized_at: string | null }
  onClose: () => void
}

/**
 * The entries behind one leaderboard: search, edit a row's points or payout,
 * delete rows, refresh. Opened from the overview's actions column.
 *
 * While a board is unfinalised the payout column is derived from the live rank,
 * so editing points immediately shows what that user would win. Once finalised
 * the stored prize is the record and is shown as-is.
 */
export function LeaderboardEntriesDialog({ leaderboard, onClose }: Props) {
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ username: "", wager_amount: "", prize_amount: "" })
  const supabaseRef = useRef(createClient())

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabaseRef.current
      .from("leaderboard_entries")
      .select("id, rank, username, user_ref, wager_amount, prize_amount")
      .eq("leaderboard_id", leaderboard.id)
      .order("wager_amount", { ascending: false })

    if (error) console.error("[v0] Error loading entries:", error)
    else setEntries((data ?? []) as EntryRow[])
    setLoading(false)
  }, [leaderboard.id])

  useEffect(() => {
    load()
  }, [load])

  // Escape closes, as with any modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const ranked = [...entries]
      .sort((a, b) => Number(b.wager_amount) - Number(a.wager_amount))
      .map((entry, index) => ({
        ...entry,
        liveRank: index + 1,
        // Unfinalised boards show what the current standing would pay.
        payout: leaderboard.finalized_at
          ? Number(entry.prize_amount)
          : prizeFor(index + 1, Number(leaderboard.prize_pool) || 0, leaderboard.payout_preset),
      }))
    if (!needle) return ranked
    return ranked.filter(
      (entry) =>
        entry.username?.toLowerCase().includes(needle) ||
        entry.user_ref?.toLowerCase().includes(needle) ||
        entry.id.toLowerCase().includes(needle),
    )
  }, [entries, query, leaderboard])

  async function saveEdit(id: string) {
    const patch = {
      username: draft.username,
      wager_amount: Number.parseFloat(draft.wager_amount) || 0,
      prize_amount: Number.parseFloat(draft.prize_amount) || 0,
    }
    const { error } = await supabaseRef.current.from("leaderboard_entries").update(patch).eq("id", id)
    if (error) {
      console.error("[v0] Error updating entry:", error)
      return
    }
    setEditing(null)
    await load()
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    const { error } = await supabaseRef.current
      .from("leaderboard_entries")
      .delete()
      .in("id", Array.from(selected))
    if (error) {
      console.error("[v0] Error deleting entries:", error)
      return
    }
    setSelected(new Set())
    await load()
  }

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/[0.10] bg-[#0E0E11]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`Entries for ${leaderboard.title}`}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search user, id…"
              className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </div>

          <button
            type="button"
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-[#E5484D]/40 hover:text-[#E5484D] disabled:opacity-35 disabled:hover:border-white/[0.10] disabled:hover:text-white/50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>

          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-1 rounded-md p-2 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#141418]">
              <tr className="border-b border-white/[0.08] text-left">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))
                    }
                    className="h-3.5 w-3.5 accent-[#5B8DEF]"
                  />
                </th>
                {["Place", "Id", "User", "Points", "Payout", "Actions"].map((column) => (
                  <th key={column} className="px-3 py-2.5 font-normal">
                    <MonoLabel className="text-white/30">{column}</MonoLabel>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center font-mono text-[11px] uppercase tracking-widest text-white/25">
                    Loading
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[12.5px] text-white/30">
                    No entries{query ? " match that search" : " yet"}.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isEditing = editing === row.id
                  return (
                    <tr key={row.id} className="border-b border-white/[0.05] text-[13px] hover:bg-white/[0.03]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.username}`}
                          checked={selected.has(row.id)}
                          onChange={() =>
                            setSelected((current) => {
                              const next = new Set(current)
                              next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                              return next
                            })
                          }
                          className="h-3.5 w-3.5 accent-[#5B8DEF]"
                        />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-white/60">#{row.liveRank}</td>
                      <td className="px-3 py-2">
                        <CopyableId value={row.user_ref ?? row.id} />
                      </td>
                      <td className="px-3 py-2 text-white/85">
                        {isEditing ? (
                          <input
                            value={draft.username}
                            onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                            className="h-7 w-full rounded border border-white/15 bg-black/50 px-2 text-[12.5px] text-white outline-none"
                          />
                        ) : (
                          row.username
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-white/70">
                        {isEditing ? (
                          <input
                            type="number"
                            value={draft.wager_amount}
                            onChange={(event) => setDraft({ ...draft, wager_amount: event.target.value })}
                            className="h-7 w-28 rounded border border-white/15 bg-black/50 px-2 text-[12.5px] tabular-nums text-white outline-none"
                          />
                        ) : (
                          Number(row.wager_amount).toLocaleString()
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums" style={{ color: ACCENTS.green }}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={draft.prize_amount}
                            onChange={(event) => setDraft({ ...draft, prize_amount: event.target.value })}
                            className="h-7 w-28 rounded border border-white/15 bg-black/50 px-2 text-[12.5px] tabular-nums text-white outline-none"
                          />
                        ) : (
                          row.payout.toLocaleString()
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(row.id)}
                              aria-label="Save"
                              className="rounded p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-[#46C48A]"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              aria-label="Cancel"
                              className="rounded p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Edit ${row.username}`}
                            onClick={() => {
                              setEditing(row.id)
                              setDraft({
                                username: row.username ?? "",
                                wager_amount: String(row.wager_amount ?? 0),
                                prize_amount: String(row.payout ?? 0),
                              })
                            }}
                            className="rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.08] px-3 py-2">
          <MonoLabel className="text-white/30">
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </MonoLabel>
          <MonoLabel className="text-white/30">
            {leaderboard.finalized_at ? "Finalised — payouts are the record" : "Live — payouts follow the standings"}
          </MonoLabel>
        </div>
      </div>
    </div>
  )
}
