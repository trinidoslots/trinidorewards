"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { ACCENTS, Panel } from "@/components/ui/panel"
import {
  RaffleHeader,
  RaffleRows,
  RaffleTotals,
  useAdminRaffles,
  type RaffleRow,
} from "@/components/admin/raffle-list"

/**
 * Raffles that are open, plus the ones about to be.
 *
 * Both are shown: an upcoming raffle is the one most likely to need a last
 * edit, and filtering it out meant opening History to find it.
 */
export default function ActiveRafflesPage() {
  const { rows, loading, error, reload, supabase, setRows } = useAdminRaffles()

  const live = rows.filter((row) => row.phase === "active" || row.phase === "upcoming")

  async function remove(row: RaffleRow) {
    if (!confirm(`Delete "${row.raffle.title}" and every entry in it?`)) return
    const { error: problem } = await supabase.from("raffles").delete().eq("id", row.raffle.id)
    if (problem) {
      console.error("[v0] Could not delete raffle:", problem)
      return
    }
    setRows((current) => current.filter((entry) => entry.raffle.id !== row.raffle.id))
  }

  return (
    <div className="space-y-4">
      <RaffleHeader title="Active raffles" hint="Open now, and opening soon." loading={loading} onReload={reload}>
        <Link
          href="/admin/raffles/create"
          className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition"
          style={{ backgroundColor: ACCENTS.blue }}
        >
          <Plus className="h-3.5 w-3.5" />
          New raffle
        </Link>
      </RaffleHeader>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <RaffleTotals rows={live} />
      <RaffleRows rows={live} loading={loading} empty="No raffles are open or scheduled." onDelete={remove} />
    </div>
  )
}
