"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { HuntKpis } from "@/lib/active-hunt"
import { HuntKpiBoard, type HuntBonusRow } from "@/components/hunt-kpi-board"

const money = (value: number) => `$${value.toFixed(2)}`

function formatDate(value: string | null) {
  if (!value) return "Unknown date"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function PreviousHuntsPanel() {
  const [endedHunts, setEndedHunts] = useState<HuntKpis[]>([])
  const [selectedHuntId, setSelectedHuntId] = useState<string | null>(null)
  const [selectedBonuses, setSelectedBonuses] = useState<HuntBonusRow[]>([])
  const [activeStreamer, setActiveStreamer] = useState("ALL")
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [bonusesLoading, setBonusesLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function loadEndedHunts() {
      const { data, error } = await supabase
        .from("bonus_hunt_kpis")
        .select("*")
        .eq("status", "ended")
        .order("ended_at", { ascending: false })

      if (error) {
        console.error("[v0] Error loading past hunts:", error)
        setLoading(false)
        return
      }

      const hunts = (data || []) as HuntKpis[]
      setEndedHunts(hunts)
      setSelectedHuntId(hunts[0]?.hunt_id ?? null)
      setLoading(false)
    }
    loadEndedHunts()
  }, [])

  useEffect(() => {
    async function loadBonuses() {
      if (!selectedHuntId) {
        setSelectedBonuses([])
        return
      }
      setBonusesLoading(true)
      const { data, error } = await supabase
        .from("hunt_bonuses")
        .select("id, game_name, provider, bet_size, result, is_super, image_url, position")
        .eq("hunt_id", selectedHuntId)
        .order("position", { ascending: true })
      if (error) {
        console.error("[v0] Error loading hunt bonuses:", error)
      } else {
        setSelectedBonuses((data || []) as HuntBonusRow[])
      }
      setBonusesLoading(false)
    }
    loadBonuses()
  }, [selectedHuntId])

  const streamers = useMemo(() => {
    const unique = Array.from(new Set(endedHunts.map((h) => h.streamer).filter(Boolean)))
    return unique.sort((a, b) => a.localeCompare(b))
  }, [endedHunts])

  const filteredHunts = useMemo(() => {
    const byTab = activeStreamer === "ALL" ? endedHunts : endedHunts.filter((h) => h.streamer === activeStreamer)
    const normalized = query.trim().toLowerCase()
    if (!normalized) return byTab
    return byTab.filter((h) => `${h.streamer} ${h.title ?? ""}`.toLowerCase().includes(normalized))
  }, [endedHunts, activeStreamer, query])

  const selectedHunt = endedHunts.find((h) => h.hunt_id === selectedHuntId) ?? null

  if (loading) {
    return <div className="p-6 text-slate-400">Loading hunt archive…</div>
  }

  return (
    <>
      <section className="mb-8 rounded-3xl border border-cyan-200/15 bg-slate-900/75 p-3 shadow-xl shadow-cyan-950/15 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-300">
              {selectedHunt ? (
                <>
                  Viewing <span className="font-semibold text-cyan-200">{selectedHunt.streamer}</span>
                  {selectedHunt.title ? <> · {selectedHunt.title}</> : null} · {formatDate(selectedHunt.ended_at ?? selectedHunt.created_at)}
                </>
              ) : (
                "No completed hunts yet."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/50 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/40 hover:text-white"
          >
            {listOpen ? "Hide hunt list" : "Browse past hunts"}
            <ChevronDown className={`h-4 w-4 transition-transform ${listOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {listOpen && (
          <div className="mt-3 border-t border-slate-800/80 pt-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
                <button
                  type="button"
                  onClick={() => setActiveStreamer("ALL")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${activeStreamer === "ALL" ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
                >
                  All
                </button>
                {streamers.map((streamer) => (
                  <button
                    key={streamer}
                    type="button"
                    onClick={() => setActiveStreamer(streamer)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${activeStreamer === streamer ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {streamer}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  aria-label="Search hunts"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search streamer or title"
                  className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-300/50"
                />
              </div>
            </div>

            <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">
              {filteredHunts.length} ended hunt{filteredHunts.length === 1 ? "" : "s"}
            </p>

            <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {filteredHunts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">No hunts match.</p>
              ) : (
                filteredHunts.map((hunt) => (
                  <button
                    key={hunt.hunt_id}
                    type="button"
                    onClick={() => {
                      setSelectedHuntId(hunt.hunt_id)
                      setListOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left text-sm transition ${
                      hunt.hunt_id === selectedHuntId
                        ? "border-cyan-300/40 bg-cyan-300/[0.08]"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {hunt.streamer}
                        {hunt.title ? <span className="text-slate-400"> · {hunt.title}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{formatDate(hunt.ended_at ?? hunt.created_at)} · {hunt.total_bonuses} bonuses</p>
                    </div>
                    <p className={`shrink-0 font-semibold ${Number(hunt.total_won) - Number(hunt.starting_balance) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {Number(hunt.total_won) - Number(hunt.starting_balance) >= 0 ? "+" : "-"}
                      {money(Math.abs(Number(hunt.total_won) - Number(hunt.starting_balance)))}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      {!selectedHunt ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
          No completed hunts yet. Once a hunt ends, it will show up here.
        </div>
      ) : bonusesLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">Loading hunt…</div>
      ) : (
        <HuntKpiBoard
          hunts={selectedBonuses}
          kpis={selectedHunt}
          tableEyebrow="Final board"
          tableTitle={`${selectedHunt.streamer}${selectedHunt.title ? ` · ${selectedHunt.title}` : ""}`}
        />
      )}
    </>
  )
}
