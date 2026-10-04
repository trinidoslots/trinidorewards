"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { createClient } from "@/lib/supabase/client"
import type { HuntKpis } from "@/lib/active-hunt"
import { HuntKpiBoard, type HuntBonusRow } from "@/components/hunt-kpi-board"
import { Swap } from "@/components/swap"

/** The site's ease-out, as the tabs and page transitions use it. */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const money = (value: number) => `$${value.toFixed(2)}`

function formatDate(value: string | null) {
  if (!value) return "Unknown date"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const control =
  "inline-flex h-10 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.03] text-white/70 transition hover:border-white/30 hover:text-white disabled:pointer-events-none disabled:opacity-30"

/** What the hunt paid against its starting balance, signed and coloured. */
function Profit({ hunt }: { hunt: HuntKpis }) {
  const diff = Number(hunt.total_won) - Number(hunt.starting_balance)
  return (
    <span className="font-semibold tabular-nums" style={{ color: diff >= 0 ? ACCENTS.green : ACCENTS.red }}>
      {diff >= 0 ? "+" : "-"}
      {money(Math.abs(diff))}
    </span>
  )
}

export function PreviousHuntsPanel() {
  const [endedHunts, setEndedHunts] = useState<HuntKpis[]>([])
  const [selectedHuntId, setSelectedHuntId] = useState<string | null>(null)
  const [selectedBonuses, setSelectedBonuses] = useState<HuntBonusRow[]>([])
  /** Which hunt selectedBonuses belong to, so the board never pairs one hunt's numbers with another's bonuses. */
  const [bonusesFor, setBonusesFor] = useState<string | null>(null)
  const [activeStreamer, setActiveStreamer] = useState("ALL")
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
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
    if (!selectedHuntId) {
      setSelectedBonuses([])
      setBonusesFor(null)
      return
    }
    // Clicking through the list quickly starts several loads; only the last
    // one may land, or an earlier hunt's bonuses could arrive after a later
    // hunt was picked and be shown under its name.
    let current = true
    async function loadBonuses(huntId: string) {
      const { data, error } = await supabase
        .from("hunt_bonuses")
        .select("id, game_name, provider, bet_size, result, is_super, image_url, position")
        .eq("hunt_id", huntId)
        .order("position", { ascending: true })
      if (!current) return
      if (error) console.error("[v0] Error loading hunt bonuses:", error)
      setSelectedBonuses(error ? [] : ((data || []) as HuntBonusRow[]))
      setBonusesFor(huntId)
    }
    loadBonuses(selectedHuntId)
    return () => {
      current = false
    }
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

  const selectedIndex = endedHunts.findIndex((h) => h.hunt_id === selectedHuntId)
  const step = (by: number) => {
    const next = endedHunts[selectedIndex + by]
    if (next) setSelectedHuntId(next.hunt_id)
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-[104px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
        <div className="h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      </div>
    )
  }

  return (
    <>
      <section className="mb-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01]">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <MonoLabel style={{ color: ACCENTS.blue }}>
              {selectedHunt ? `Viewing · ${selectedIndex + 1} of ${endedHunts.length}` : "Hunt archive"}
            </MonoLabel>
            {selectedHunt ? (
              <>
                <p className="mt-2 truncate text-[20px] font-bold leading-tight text-white">
                  {selectedHunt.streamer}
                  {selectedHunt.title ? <span className="text-white/45"> · {selectedHunt.title}</span> : null}
                </p>
                <p className="mt-1 text-[13px] text-white/45">
                  {formatDate(selectedHunt.ended_at ?? selectedHunt.created_at)} · {selectedHunt.total_bonuses} bonuses ·{" "}
                  <Profit hunt={selectedHunt} />
                </p>
              </>
            ) : (
              <p className="mt-2 text-[15px] text-white/55">No completed hunts yet.</p>
            )}
          </div>

          {endedHunts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => step(1)}
                disabled={selectedIndex >= endedHunts.length - 1}
                aria-label="Older hunt"
                title="Older hunt"
                className={`${control} w-10`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={selectedIndex <= 0}
                aria-label="Newer hunt"
                title="Newer hunt"
                className={`${control} w-10`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                aria-expanded={listOpen}
                className={`${control} flex-1 gap-2 px-4 text-[13.5px] font-semibold sm:flex-none`}
                style={listOpen ? { borderColor: `${ACCENTS.blue}66`, color: "#fff" } : undefined}
              >
                {listOpen ? "Hide list" : "All past hunts"}
                <ChevronDown className={`h-4 w-4 transition-transform ${listOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
        {listOpen && (
          <motion.div
            key="hunt-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
          <div className="border-t border-white/[0.07] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {streamers.length > 1 && (
                <div className="inline-flex flex-wrap gap-1 self-start rounded-full border border-white/[0.10] bg-black/40 p-1">
                  {["ALL", ...streamers].map((streamer) => {
                    const active = activeStreamer === streamer
                    return (
                      <button
                        key={streamer}
                        type="button"
                        onClick={() => setActiveStreamer(streamer)}
                        className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition"
                        style={active ? { backgroundColor: ACCENTS.blue, color: "#000" } : { color: "rgba(255,255,255,0.55)" }}
                      >
                        {streamer === "ALL" ? "All" : streamer}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="relative w-full sm:ml-auto sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  aria-label="Search hunts"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search streamer or title…"
                  className="h-10 w-full rounded-md border border-white/[0.10] bg-black/40 pl-10 pr-3 text-[14px] text-white outline-none transition placeholder:text-white/30 focus:border-white/25"
                />
              </div>
            </div>

            <MonoLabel className="mt-4 block text-white/35">
              {filteredHunts.length} ended hunt{filteredHunts.length === 1 ? "" : "s"}
            </MonoLabel>

            <div className="mt-3 max-h-[26rem] overflow-y-auto pr-1">
              <AnimatePresence initial={false} mode="popLayout">
              {filteredHunts.length === 0 ? (
                <motion.p
                  key="no-match"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="rounded-lg border border-dashed border-white/[0.10] px-4 py-8 text-center text-[13px] text-white/40"
                >
                  No hunts match.
                </motion.p>
              ) : (
                filteredHunts.map((hunt) => {
                  const active = hunt.hunt_id === selectedHuntId
                  const date = new Date(hunt.ended_at ?? hunt.created_at)
                  return (
                    <motion.button
                      key={hunt.hunt_id}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.26, ease: EASE }}
                      type="button"
                      // The list stays open: picking a hunt used to close it,
                      // so comparing two hunts meant reopening it every time.
                      onClick={() => setSelectedHuntId(hunt.hunt_id)}
                      aria-pressed={active}
                      className="relative mb-2 flex w-full items-center gap-4 overflow-hidden rounded-lg border py-3 pl-4 pr-4 text-left transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.04]"
                      style={
                        active
                          ? { borderColor: `${ACCENTS.blue}66`, backgroundColor: `${ACCENTS.blue}12` }
                          : { borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.015)" }
                      }
                    >
                      {active && (
                        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: ACCENTS.blue }} />
                      )}
                      <div className="flex w-11 shrink-0 flex-col items-center rounded-md border border-white/[0.08] bg-black/30 py-1.5">
                        <MonoLabel className="text-white/40">
                          {Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short" })}
                        </MonoLabel>
                        <span className="mt-0.5 text-[17px] font-black leading-none tabular-nums text-white">
                          {Number.isNaN(date.getTime()) ? "?" : date.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-white">
                          {hunt.streamer}
                          {hunt.title ? <span className="font-normal text-white/45"> · {hunt.title}</span> : null}
                        </p>
                        <p className="mt-0.5 text-[12px] tabular-nums text-white/40">
                          {date.getFullYear()} · {hunt.total_bonuses} bonuses
                        </p>
                      </div>
                      <span className="shrink-0 text-[14px] font-bold tabular-nums">
                        <Profit hunt={hunt} />
                      </span>
                    </motion.button>
                  )
                })
              )}
              </AnimatePresence>
            </div>
          </div>
          </motion.div>
        )}
        </AnimatePresence>
      </section>

      {!selectedHunt ? (
        <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.015] p-12 text-center text-[13.5px] text-white/45">
          No completed hunts yet. Once a hunt ends, it will show up here.
        </div>
      ) : (
        // The old board fades out on the click and the new one rises in once
        // its bonuses are here, with the height eased between the two. The
        // "Loading hunt…" box that used to sit in between made every switch
        // two jumps.
        <Swap on={selectedHunt.hunt_id} ready={bonusesFor === selectedHunt.hunt_id}>
          <HuntKpiBoard
            hunts={bonusesFor === selectedHunt.hunt_id ? selectedBonuses : []}
            kpis={selectedHunt}
            tableEyebrow="Final board"
            tableTitle={`${selectedHunt.streamer}${selectedHunt.title ? ` · ${selectedHunt.title}` : ""}`}
          />
        </Swap>
      )}
    </>
  )
}
