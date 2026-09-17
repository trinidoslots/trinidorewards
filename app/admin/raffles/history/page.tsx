"use client"

import { RaffleHeader, RaffleRows, RaffleTotals, useAdminRaffles } from "@/components/admin/raffle-list"
import { ACCENTS, Panel } from "@/components/ui/panel"

/**
 * Raffles that are over: drawn, or closed and still waiting on a draw.
 *
 * It used to filter on status = 'drawn', which is set by a stored procedure
 * that may never have run — closed raffles awaiting a winner appeared nowhere
 * at all.
 */
export default function RaffleHistoryPage() {
  const { rows, loading, error, reload } = useAdminRaffles()

  const past = rows.filter((row) => row.phase === "drawn" || row.phase === "ended")

  return (
    <div className="space-y-4">
      <RaffleHeader
        title="Raffle history"
        hint="Everything that has closed, drawn or not."
        loading={loading}
        onReload={reload}
      />

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <RaffleTotals rows={past} />
      <RaffleRows rows={past} loading={loading} empty="No raffles have finished yet." />
    </div>
  )
}
