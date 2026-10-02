"use client"

import { adminHref } from "@/lib/admin-host"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, Crown, Gamepad2, History, Loader2, Pencil, Save, Search, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { HuntKpis } from "@/lib/active-hunt"
import { useToast } from "@/hooks/use-toast"
import { ACCENTS, MonoLabel, Panel, StatTile } from "@/components/ui/panel"

/**
 * Past bonus hunts: how each went, edit the header of one, or delete it.
 *
 * Figures come from the bonus_hunt_kpis view, the same numbers the public
 * pages show, so this page and the site cannot disagree about a hunt.
 */

type BonusDetail = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  is_super: boolean
  image_url?: string | null
}

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

const money = (value: number) =>
  `$${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (value: number) => `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}`

export default function AdminHistoryPage() {
  const [supabase] = useState(() => createClient())
  const { toast } = useToast()
  const [hunts, setHunts] = useState<HuntKpis[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [bonuses, setBonuses] = useState<BonusDetail[]>([])
  const [loadingBonuses, setLoadingBonuses] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ streamer: "", title: "", starting_balance: "" })

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("bonus_hunt_kpis")
      .select("*")
      .eq("status", "ended")
      .order("ended_at", { ascending: false })
    if (error) {
      console.error("[v0] Error fetching past hunts:", error)
      toast({ title: "Error", description: "Could not load the hunt history.", variant: "destructive" })
    } else setHunts((data || []) as HuntKpis[])
    setLoading(false)
  }, [supabase, toast])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return hunts
    return hunts.filter((hunt) => `${hunt.streamer} ${hunt.title ?? ""}`.toLowerCase().includes(needle))
  }, [hunts, query])

  const totals = useMemo(() => {
    const won = hunts.reduce((sum, hunt) => sum + (Number(hunt.total_won) || 0), 0)
    const start = hunts.reduce((sum, hunt) => sum + (Number(hunt.starting_balance) || 0), 0)
    const best = hunts.reduce(
      (top, hunt) => (Number(hunt.best_multiplier) > top.multi ? { multi: Number(hunt.best_multiplier), game: hunt.best_multiplier_game } : top),
      { multi: 0, game: null as string | null },
    )
    return { won, profit: won - start, best }
  }, [hunts])

  async function toggle(huntId: string) {
    if (expanded === huntId) {
      setExpanded(null)
      return
    }
    setExpanded(huntId)
    setLoadingBonuses(true)
    const { data, error } = await supabase
      .from("hunt_bonuses")
      .select("id, game_name, provider, bet_size, result, is_super, image_url, position")
      .eq("hunt_id", huntId)
      .order("position", { ascending: true })
    setLoadingBonuses(false)
    if (error) {
      console.error("[v0] Error fetching hunt bonuses:", error)
      setBonuses([])
    } else setBonuses((data || []) as BonusDetail[])
  }

  function startEditing(hunt: HuntKpis) {
    setEditing(hunt.hunt_id)
    setEditForm({ streamer: hunt.streamer, title: hunt.title ?? "", starting_balance: String(hunt.starting_balance) })
  }

  async function saveEdit(huntId: string) {
    const { error } = await supabase
      .from("bonus_hunts")
      .update({
        streamer: editForm.streamer.trim(),
        title: editForm.title.trim() || null,
        starting_balance: Number.parseFloat(editForm.starting_balance),
      })
      .eq("id", huntId)
    if (error) {
      console.error("[v0] Error updating hunt:", error)
      toast({ title: "Error", description: "Could not save the hunt.", variant: "destructive" })
      return
    }
    setEditing(null)
    load()
  }

  async function remove(huntId: string) {
    if (!confirm("Permanently delete this hunt and all of its bonuses? This cannot be undone.")) return
    const { error } = await supabase.from("bonus_hunts").delete().eq("id", huntId)
    if (error) {
      console.error("[v0] Error deleting hunt:", error)
      toast({ title: "Error", description: "Could not delete the hunt.", variant: "destructive" })
      return
    }
    if (expanded === huntId) setExpanded(null)
    setHunts((current) => current.filter((hunt) => hunt.hunt_id !== huntId))
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Hunt history</h1>
          <p className="mt-1 text-[13px] text-white/40">Every finished hunt – edit its details or delete it.</p>
        </div>
        <Link
          href={adminHref("/admin/bonushunt")}
          className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          Current hunt
        </Link>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Hunts" value={hunts.length.toLocaleString()} />
        <StatTile label="Total won" value={money(totals.won)} accent="green" />
        <StatTile label="Overall profit / loss" value={signed(totals.profit)} accent={totals.profit >= 0 ? "green" : "red"} />
        <StatTile
          label="Best multiplier"
          value={totals.best.multi ? `${totals.best.multi.toFixed(1)}x` : "—"}
          accent="amber"
          hint={totals.best.game ?? undefined}
        />
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search streamer or title…"
              className={`${field} pl-9`}
            />
          </div>
          <MonoLabel className="text-white/25">{rows.length} hunts</MonoLabel>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <History className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">{hunts.length ? "No hunt matches that search." : "No finished hunts yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead className="bg-[#141418]">
                <tr className="border-b border-white/[0.08] text-left">
                  {["", "Hunt", "Ended", "Bonuses", "Start", "Won", "Profit / loss", "Best", ""].map((heading, index) => (
                    <th key={index} className="px-3 py-2.5">
                      <MonoLabel className="text-white/35">{heading}</MonoLabel>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((hunt) => {
                  const isOpen = expanded === hunt.hunt_id
                  const profit = Number(hunt.total_won) - Number(hunt.starting_balance)
                  const isEditing = editing === hunt.hunt_id
                  return (
                    <HuntRows
                      key={hunt.hunt_id}
                      hunt={hunt}
                      profit={profit}
                      isOpen={isOpen}
                      isEditing={isEditing}
                      editForm={editForm}
                      setEditForm={setEditForm}
                      bonuses={isOpen ? bonuses : []}
                      loadingBonuses={isOpen && loadingBonuses}
                      onToggle={() => toggle(hunt.hunt_id)}
                      onEdit={() => startEditing(hunt)}
                      onCancel={() => setEditing(null)}
                      onSave={() => saveEdit(hunt.hunt_id)}
                      onDelete={() => remove(hunt.hunt_id)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function HuntRows({
  hunt,
  profit,
  isOpen,
  isEditing,
  editForm,
  setEditForm,
  bonuses,
  loadingBonuses,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  hunt: HuntKpis
  profit: number
  isOpen: boolean
  isEditing: boolean
  editForm: { streamer: string; title: string; starting_balance: string }
  setEditForm: (form: { streamer: string; title: string; starting_balance: string }) => void
  bonuses: BonusDetail[]
  loadingBonuses: boolean
  onToggle: () => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <>
      <tr className="border-b border-white/[0.05] hover:bg-white/[0.02]">
        <td className="w-8 px-2 py-2.5">
          <button type="button" onClick={onToggle} aria-label={isOpen ? "Collapse" : "Expand"} className="rounded p-1 text-white/25 transition hover:text-white">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </td>
        {isEditing ? (
          <td colSpan={7} className="px-3 py-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={editForm.streamer} onChange={(e) => setEditForm({ ...editForm, streamer: e.target.value })} placeholder="Streamer" className={field} />
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title (optional)" className={field} />
              <input
                type="number"
                step="0.01"
                value={editForm.starting_balance}
                onChange={(e) => setEditForm({ ...editForm, starting_balance: e.target.value })}
                placeholder="Starting balance"
                className={`${field} tabular-nums`}
              />
            </div>
          </td>
        ) : (
          <>
            <td className="px-3 py-2.5">
              <p className="font-medium text-white">{hunt.title || hunt.streamer}</p>
              {hunt.title && <p className="text-[11px] text-white/30">{hunt.streamer}</p>}
            </td>
            <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-white/40">
              {new Date(hunt.ended_at ?? hunt.created_at).toLocaleDateString()}
            </td>
            <td className="px-3 py-2.5 tabular-nums text-white/70">{hunt.total_bonuses}</td>
            <td className="px-3 py-2.5 tabular-nums text-white/70">{money(Number(hunt.starting_balance))}</td>
            <td className="px-3 py-2.5 tabular-nums" style={{ color: ACCENTS.green }}>
              {money(Number(hunt.total_won))}
            </td>
            <td className="px-3 py-2.5 font-semibold tabular-nums" style={{ color: profit >= 0 ? ACCENTS.green : ACCENTS.red }}>
              {signed(profit)}
            </td>
            <td className="px-3 py-2.5 tabular-nums" style={{ color: ACCENTS.amber }}>
              {Number(hunt.best_multiplier).toFixed(1)}x
            </td>
          </>
        )}
        <td className="px-2 py-2.5">
          <div className="flex justify-end gap-0.5">
            {isEditing ? (
              <>
                <button type="button" onClick={onSave} title="Save" className="rounded p-1.5 transition hover:bg-white/[0.06]" style={{ color: ACCENTS.green }}>
                  <Save className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={onCancel} title="Cancel" className="rounded p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onEdit} title="Edit" className="rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={onDelete} title="Delete" className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-white/[0.05] bg-black/25">
          <td colSpan={9} className="px-5 py-4">
            <dl className="mb-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Best multiplier" value={`${Number(hunt.best_multiplier).toFixed(2)}x`} hint={hunt.best_multiplier_game} color={ACCENTS.amber} />
              <Detail label="Best cash win" value={money(Number(hunt.best_cash_win))} hint={hunt.best_cash_win_game} color={ACCENTS.green} />
              <Detail label="Average multi" value={`${Number(hunt.average_multi).toFixed(2)}x`} color={ACCENTS.amber} />
              <Detail label="Average bet" value={money(Number(hunt.average_bet))} />
            </dl>
            {loadingBonuses ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-white/30" />
            ) : bonuses.length === 0 ? (
              <p className="text-[12.5px] text-white/30">This hunt has no bonuses.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {bonuses.map((bonus) => {
                  const multi = bonus.result !== null && bonus.bet_size ? Number(bonus.result) / Number(bonus.bet_size) : null
                  return (
                    <div key={bonus.id} className="flex items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-white/[0.03]">
                        {bonus.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external slot artwork
                          <img src={bonus.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Gamepad2 className="h-4 w-4 text-white/15" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-[12.5px] text-white">
                          {bonus.is_super && <Crown className="h-3 w-3 shrink-0" style={{ color: ACCENTS.amber }} />}
                          <span className="truncate">{bonus.game_name}</span>
                        </p>
                        <p className="text-[11px] tabular-nums text-white/35">
                          {money(Number(bonus.bet_size))} → {bonus.result !== null ? money(Number(bonus.result)) : "—"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums" style={{ color: ACCENTS.amber }}>
                        {multi !== null ? `${multi.toFixed(1)}x` : "—"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({ label, value, hint, color }: { label: string; value: string; hint?: string | null; color?: string }) {
  return (
    <div>
      <MonoLabel className="block text-white/30">{label}</MonoLabel>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums" style={{ color: color ?? "#E7E7EA" }}>
        {value}
      </p>
      {hint && <p className="truncate text-[11px] text-white/30">{hint}</p>}
    </div>
  )
}
