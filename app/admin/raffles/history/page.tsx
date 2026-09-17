"use client"

import { useState } from "react"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
import {
  RaffleHeader,
  RaffleRows,
  RaffleTotals,
  useAdminRaffles,
  type RaffleRow,
} from "@/components/admin/raffle-list"

/**
 * Raffles that are over: drawn, or closed and still waiting on a draw.
 *
 * It used to filter on status = 'drawn', which is set by a stored procedure
 * that may never have run — closed raffles awaiting a winner appeared nowhere
 * at all.
 *
 * Finished raffles stay here as they are. Hiding takes one off the public page
 * without losing who won; deleting removes it and its entries for good.
 */
export default function RaffleHistoryPage() {
  const { rows, loading, error, reload, supabase, setRows } = useAdminRaffles()
  const [problem, setProblem] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(true)

  const past = rows
    .filter((row) => row.phase === "drawn" || row.phase === "ended")
    .filter((row) => showHidden || !row.raffle.is_hidden)

  const hiddenCount = rows.filter((row) => row.raffle.is_hidden).length

  async function toggleHidden(row: RaffleRow, hidden: boolean) {
    const { error: writeError } = await supabase
      .from("raffles")
      .update({ is_hidden: hidden })
      .eq("id", row.raffle.id)

    if (writeError) {
      setProblem(writeError.message || "Could not update that raffle")
      return
    }
    setProblem(null)
    setRows((current) =>
      current.map((entry) =>
        entry.raffle.id === row.raffle.id
          ? { ...entry, raffle: { ...entry.raffle, is_hidden: hidden } }
          : entry,
      ),
    )
  }

  async function remove(row: RaffleRow) {
    const entrants = row.entrants
    const warning = entrants > 0 ? ` and all ${entrants} entries in it` : ""
    if (!confirm(`Delete "${row.raffle.title}"${warning}? This cannot be undone.`)) return

    const { error: writeError } = await supabase.from("raffles").delete().eq("id", row.raffle.id)
    if (writeError) {
      setProblem(writeError.message || "Could not delete that raffle")
      return
    }
    setProblem(null)
    setRows((current) => current.filter((entry) => entry.raffle.id !== row.raffle.id))
  }

  return (
    <div className="space-y-4">
      <RaffleHeader
        title="Raffle history"
        hint="Everything that has closed, drawn or not."
        loading={loading}
        onReload={reload}
      >
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden((current) => !current)}
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            {showHidden ? `Hide ${hiddenCount} hidden` : `Show ${hiddenCount} hidden`}
          </button>
        )}
      </RaffleHeader>

      {(problem || error) && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {problem ?? error}
        </Panel>
      )}

      <RaffleTotals rows={past} />
      <RaffleRows
        rows={past}
        loading={loading}
        empty="No raffles have finished yet."
        onDelete={remove}
        onToggleHidden={toggleHidden}
      />

      <MonoLabel className="block text-white/25">
        Hiding keeps the winner on record and takes it off the public page. Deleting removes both.
      </MonoLabel>
    </div>
  )
}
