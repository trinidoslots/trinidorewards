"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Download, Plus, RefreshCw, Trash2, Trophy, Upload, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"
import { LeaderboardEntriesDialog } from "@/components/admin/leaderboard-entries-dialog"
import { DEFAULT_PRESET_ID, PAYOUT_PRESETS, payoutSummary, rankEntries } from "@/lib/leaderboard-payouts"
import { COMMON_TIMEZONES, DEFAULT_TIMEZONE, leaderboardStatus, utcToZonedInput, zonedInputToUtc } from "@/lib/leaderboard-time"
import { parseLeaderboardCsv, type CsvResult } from "@/lib/leaderboard-csv"
import { METRICS, readMetric, type Metric } from "@/lib/leaderboard-metric"

/**
 * Creating and filling leaderboards.
 *
 * One selected board at a time: its settings on the left, its entries on the
 * right. The previous version stacked create, edit, add-entry and CSV forms
 * down a single column, all open at once.
 */

type Leaderboard = {
  id: string
  title: string
  subtitle: string | null
  prize_pool: number
  prize_distribution_type: string | null
  payout_preset: string | null
  ranking_metric: string | null
  timezone: string | null
  api_url: string | null
  api_key: string | null
  image_url: string | null
  start_date: string
  end_date: string
  status: string
}

type Draft = {
  title: string
  subtitle: string
  prize_pool: string
  payout_preset: string
  ranking_metric: Metric
  timezone: string
  image_url: string
  api_url: string
  api_key: string
  start_date: string
  end_date: string
}

const emptyDraft = (): Draft => ({
  title: "",
  subtitle: "",
  prize_pool: "",
  payout_preset: DEFAULT_PRESET_ID,
  ranking_metric: "wagered",
  timezone: DEFAULT_TIMEZONE,
  image_url: "",
  api_url: "",
  api_key: "",
  start_date: "",
  end_date: "",
})

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

const money = (value: number) => "$" + Math.round(Number(value) || 0).toLocaleString("en-US")

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/25">{hint}</p>}
    </div>
  )
}

export default function LeaderboardsManagePage() {
  const supabaseRef = useRef(createClient())

  const [boards, setBoards] = useState<Leaderboard[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [entryCount, setEntryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null)

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [showEntries, setShowEntries] = useState(false)

  const [entryName, setEntryName] = useState("")
  const [entryWager, setEntryWager] = useState("")
  const [entryEarned, setEntryEarned] = useState("")
  const [csv, setCsv] = useState<CsvResult | null>(null)

  const board = boards.find((entry) => entry.id === selected) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabaseRef.current
      .from("leaderboards")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching leaderboards:", error)
      setNotice({ tone: "error", text: error.message || "Could not load leaderboards" })
    } else {
      const rows = (data ?? []) as Leaderboard[]
      setBoards(rows)
      setSelected((current) => current ?? rows[0]?.id ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Loaded into the form whenever the selection changes, so editing is the
  // default rather than something behind another button.
  useEffect(() => {
    if (!board) return
    setCreating(false)
    setDraft({
      title: board.title ?? "",
      subtitle: board.subtitle ?? "",
      prize_pool: String(board.prize_pool ?? ""),
      payout_preset: board.payout_preset ?? board.prize_distribution_type ?? DEFAULT_PRESET_ID,
      ranking_metric: readMetric(board.ranking_metric),
      timezone: board.timezone ?? DEFAULT_TIMEZONE,
      image_url: board.image_url ?? "",
      api_url: board.api_url ?? "",
      api_key: board.api_key ?? "",
      start_date: utcToZonedInput(board.start_date, board.timezone ?? DEFAULT_TIMEZONE),
      end_date: utcToZonedInput(board.end_date, board.timezone ?? DEFAULT_TIMEZONE),
    })
  }, [board?.id])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    ;(async () => {
      const { count } = await supabaseRef.current
        .from("leaderboard_entries")
        .select("id", { count: "exact", head: true })
        .eq("leaderboard_id", selected)
      if (!cancelled) setEntryCount(count ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [selected, showEntries, csv])

  const summary = useMemo(
    () => payoutSummary(Number.parseFloat(draft.prize_pool) || 0, draft.payout_preset),
    [draft.prize_pool, draft.payout_preset],
  )

  const set = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }))

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setNotice(null)

    if (!draft.title.trim()) {
      setNotice({ tone: "error", text: "A title is required." })
      return
    }
    if (!draft.start_date || !draft.end_date) {
      setNotice({ tone: "error", text: "A start and an end are required." })
      return
    }

    setBusy(true)
    const zone = draft.timezone || DEFAULT_TIMEZONE
    const payload = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim() || null,
      prize_pool: Number.parseFloat(draft.prize_pool) || 0,
      payout_preset: draft.payout_preset,
      prize_distribution_type: draft.payout_preset,
      ranking_metric: draft.ranking_metric,
      timezone: zone,
      image_url: draft.image_url.trim() || null,
      api_url: draft.api_url.trim() || null,
      api_key: draft.api_key.trim() || null,
      // Entered in the board's own timezone and stored as an instant, so a
      // board that runs "1st to 30th, Berlin time" means that everywhere.
      start_date: zonedInputToUtc(draft.start_date, zone),
      end_date: zonedInputToUtc(draft.end_date, zone),
    }

    const supabase = supabaseRef.current
    const { data, error } = creating
      ? await supabase.from("leaderboards").insert([{ ...payload, status: "active" }]).select("id").single()
      : await supabase.from("leaderboards").update(payload).eq("id", selected!).select("id").single()

    setBusy(false)

    if (error) {
      console.error("[v0] Could not save leaderboard:", error)
      setNotice({ tone: "error", text: error.message || "Could not save that leaderboard" })
      return
    }
    setNotice({ tone: "info", text: creating ? "Leaderboard created." : "Saved." })
    setCreating(false)
    await load()
    if (data?.id) setSelected(data.id)
  }

  async function removeBoard() {
    if (!board) return
    if (!confirm(`Delete "${board.title}" and every entry in it?`)) return
    const { error } = await supabaseRef.current.from("leaderboards").delete().eq("id", board.id)
    if (error) {
      setNotice({ tone: "error", text: error.message || "Could not delete that leaderboard" })
      return
    }
    setSelected(null)
    await load()
  }

  async function addEntry(event: React.FormEvent) {
    event.preventDefault()
    if (!board || !entryName.trim()) return

    setBusy(true)
    const { error } = await supabaseRef.current.from("leaderboard_entries").insert([
      {
        leaderboard_id: board.id,
        username: entryName.trim(),
        total_wagered: Number.parseFloat(entryWager) || 0,
        total_earned: Number.parseFloat(entryEarned) || 0,
        // Rank and prize are derived from the field, so they are left to the
        // ranking rather than guessed one row at a time.
        rank: 0,
        prize_amount: 0,
      },
    ])
    setBusy(false)

    if (error) {
      setNotice({ tone: "error", text: error.message || "Could not add that entry" })
      return
    }
    setEntryName("")
    setEntryWager("")
    setEntryEarned("")
    setEntryCount((current) => current + 1)
    setNotice({ tone: "info", text: "Entry added." })
  }

  function readCsv(file: File) {
    const reader = new FileReader()
    reader.onload = (event) => setCsv(parseLeaderboardCsv(String(event.target?.result ?? "")))
    reader.readAsText(file)
  }

  async function importCsv(replace: boolean) {
    if (!board || !csv || csv.rows.length === 0) return
    setBusy(true)

    const supabase = supabaseRef.current
    if (replace) {
      const { error } = await supabase.from("leaderboard_entries").delete().eq("leaderboard_id", board.id)
      if (error) {
        setBusy(false)
        setNotice({ tone: "error", text: error.message || "Could not clear the old entries" })
        return
      }
    }

    const ranked = rankEntries(
      csv.rows,
      Number(board.prize_pool) || 0,
      board.payout_preset ?? board.prize_distribution_type,
      readMetric(board.ranking_metric),
    )
    const { error } = await supabase.from("leaderboard_entries").insert(
      ranked.map((entry) => ({
        leaderboard_id: board.id,
        rank: entry.rank,
        username: entry.username,
        total_wagered: entry.total_wagered,
        total_earned: entry.total_earned,
        prize_amount: entry.prize_amount,
      })),
    )
    setBusy(false)

    if (error) {
      console.error("[v0] Could not import entries:", error)
      setNotice({ tone: "error", text: error.message || "Could not import those entries" })
      return
    }
    setNotice({ tone: "info", text: `${ranked.length} entries imported.` })
    setCsv(null)
  }

  function downloadTemplate() {
    const blob = new Blob(["username,total_wagered,total_earned\nexample_player,1500,220.50\n"], {
      type: "text/csv",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "leaderboard_template.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Manage leaderboards</h1>
          <p className="mt-1 text-[13px] text-white/40">Set one up, then fill it from a CSV or by hand.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/leaderboards/overview"
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            Overview
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(true)
              setSelected(null)
              setDraft(emptyDraft())
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition"
            style={{ backgroundColor: ACCENTS.blue }}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
      </header>

      {notice && (
        <Panel
          accent={notice.tone === "error" ? "red" : "green"}
          className="px-3.5 py-2.5 text-[13px]"
          style={{ color: notice.tone === "error" ? ACCENTS.red : ACCENTS.green }}
        >
          {notice.text}
        </Panel>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Leaderboards"
            accent="slate"
            right={<MonoLabel className="text-white/25">{boards.length}</MonoLabel>}
          />
          {loading ? (
            <div className="py-10 text-center">
              <MonoLabel className="text-white/25">Loading</MonoLabel>
            </div>
          ) : boards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Trophy className="h-6 w-6 text-white/10" />
              <p className="text-[13px] text-white/30">None yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {boards.map((entry) => {
                const state = leaderboardStatus(entry.start_date, entry.end_date)
                const active = entry.id === selected
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(entry.id)}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition hover:bg-white/[0.03]"
                      style={active ? { backgroundColor: ACCENTS.blue + "14" } : undefined}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-white">{entry.title}</p>
                        <MonoLabel className="text-white/25">{money(entry.prize_pool)}</MonoLabel>
                      </div>
                      <Tag accent={state === "active" ? "green" : state === "upcoming" ? "blue" : "slate"}>
                        {state}
                      </Tag>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-3">
          {!creating && !board ? (
            <Panel className="flex flex-col items-center gap-2 py-16">
              <Trophy className="h-7 w-7 text-white/10" />
              <p className="text-[13px] text-white/30">Pick a leaderboard, or make a new one.</p>
            </Panel>
          ) : (
            <form onSubmit={save} className="space-y-3">
              <Panel accent={creating ? "green" : "blue"}>
                <PanelHeader
                  title={creating ? "New leaderboard" : "Settings"}
                  accent={creating ? "green" : "blue"}
                  right={board ? <CopyableId value={board.id} chars={5} /> : null}
                />
                <div className="grid gap-3 p-3.5 sm:grid-cols-2">
                  <Field label="Title">
                    <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={field} />
                  </Field>
                  <Field label="Subtitle" hint="Optional.">
                    <input value={draft.subtitle} onChange={(e) => set({ subtitle: e.target.value })} className={field} />
                  </Field>
                  <Field label="Prize pool">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.prize_pool}
                      onChange={(e) => set({ prize_pool: e.target.value })}
                      className={field + " tabular-nums"}
                    />
                  </Field>
                  <Field
                    label="Payout structure"
                    hint={
                      summary.remainder !== 0
                        ? "Pays " + money(summary.paid) + " across " + summary.places + " places."
                        : undefined
                    }
                  >
                    <select
                      value={draft.payout_preset}
                      onChange={(e) => set({ payout_preset: e.target.value })}
                      className={field}
                    >
                      {PAYOUT_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id} className="bg-[#121216]">
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ranked by" hint={METRICS.find((m) => m.id === draft.ranking_metric)?.hint}>
                    <div className="grid grid-cols-2 gap-2">
                      {METRICS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => set({ ranking_metric: option.id })}
                          className="h-9 rounded-md border font-mono text-[11px] uppercase tracking-[0.1em] transition"
                          style={
                            draft.ranking_metric === option.id
                              ? {
                                  borderColor: ACCENTS.blue + "77",
                                  backgroundColor: ACCENTS.blue + "1f",
                                  color: ACCENTS.blue,
                                }
                              : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Timezone" hint="The dates below are read in this zone.">
                    <select value={draft.timezone} onChange={(e) => set({ timezone: e.target.value })} className={field}>
                      {COMMON_TIMEZONES.map((zone) => (
                        <option key={zone} value={zone} className="bg-[#121216]">
                          {zone}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Image URL" hint="Optional.">
                    <input value={draft.image_url} onChange={(e) => set({ image_url: e.target.value })} className={field} />
                  </Field>
                  <Field label="Starts">
                    <input
                      type="datetime-local"
                      value={draft.start_date}
                      onChange={(e) => set({ start_date: e.target.value })}
                      className={field}
                    />
                  </Field>
                  <Field label="Ends">
                    <input
                      type="datetime-local"
                      value={draft.end_date}
                      onChange={(e) => set({ end_date: e.target.value })}
                      className={field}
                    />
                  </Field>
                  <Field label="API URL" hint="Stored for a future import. Not called yet.">
                    <input value={draft.api_url} onChange={(e) => set({ api_url: e.target.value })} className={field} />
                  </Field>
                  <Field label="API key" hint="Stored for a future import. Not called yet.">
                    <input
                      type="password"
                      value={draft.api_key}
                      onChange={(e) => set({ api_key: e.target.value })}
                      className={field}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.08] p-3">
                  {board && (
                    <button
                      type="button"
                      onClick={removeBoard}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 transition hover:border-[#E5484D]/40 hover:text-[#E5484D]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:opacity-40"
                    style={{ backgroundColor: creating ? ACCENTS.green : ACCENTS.blue }}
                  >
                    {busy ? "Saving…" : creating ? "Create" : "Save changes"}
                  </button>
                </div>
              </Panel>
            </form>
          )}

          {board && (
            <>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <StatTile label="Entries" value={entryCount.toLocaleString()} accent="blue" />
                <StatTile label="Prize pool" value={money(board.prize_pool)} accent="amber" />
                <StatTile label="Status" value={leaderboardStatus(board.start_date, board.end_date)} accent="green" />
              </div>

              <Panel accent="purple">
                <PanelHeader
                  title="Entries"
                  accent="purple"
                  right={
                    <button
                      type="button"
                      onClick={() => setShowEntries(true)}
                      className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/40 transition hover:text-white"
                    >
                      Open all
                    </button>
                  }
                />

                <form onSubmit={addEntry} className="flex flex-wrap items-end gap-2 border-b border-white/[0.05] p-3.5">
                  <div className="min-w-40 flex-1">
                    <MonoLabel className="mb-1.5 block text-white/30">Username</MonoLabel>
                    <input value={entryName} onChange={(e) => setEntryName(e.target.value)} className={field} />
                  </div>
                  <div className="w-32">
                    <MonoLabel className="mb-1.5 block text-white/30">Wagered</MonoLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entryWager}
                      onChange={(e) => setEntryWager(e.target.value)}
                      className={field + " tabular-nums"}
                    />
                  </div>
                  <div className="w-32">
                    <MonoLabel className="mb-1.5 block text-white/30">Earned</MonoLabel>
                    {/* No min: a losing player earned a negative number, and
                        refusing to record that would quietly rank them above
                        someone who broke even. */}
                    <input
                      type="number"
                      step="0.01"
                      value={entryEarned}
                      onChange={(e) => setEntryEarned(e.target.value)}
                      className={field + " tabular-nums"}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !entryName.trim()}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12] disabled:opacity-30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </form>

                <div className="space-y-3 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white">
                      <Upload className="h-3.5 w-3.5" />
                      Choose CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) readCsv(file)
                          event.target.value = ""
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 transition hover:border-white/25 hover:text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Template
                    </button>
                    <MonoLabel className="text-white/25">Username and wager columns, comma or semicolon</MonoLabel>
                  </div>

                  {csv && (
                    <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users className="h-3.5 w-3.5" style={{ color: ACCENTS.purple }} />
                        <span className="text-[13px] text-white">
                          {csv.rows.length} {csv.rows.length === 1 ? "row" : "rows"} read
                        </span>
                        {csv.skipped.length > 0 && (
                          <MonoLabel style={{ color: ACCENTS.amber }}>{csv.skipped.length} skipped</MonoLabel>
                        )}
                        <button
                          type="button"
                          onClick={() => setCsv(null)}
                          className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-white/30 transition hover:text-white"
                        >
                          Discard
                        </button>
                      </div>

                      {/* Every skipped line is named. The old importer dropped
                          unreadable rows without a word. */}
                      {csv.skipped.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {csv.skipped.slice(0, 5).map((skip) => (
                            <li key={skip.line} className="text-[11px] text-white/30">
                              Line {skip.line}: {skip.reason}
                            </li>
                          ))}
                          {csv.skipped.length > 5 && (
                            <li className="text-[11px] text-white/20">and {csv.skipped.length - 5} more</li>
                          )}
                        </ul>
                      )}

                      {csv.rows.length > 0 && (
                        <>
                          <ul className="mt-2 max-h-40 overflow-auto rounded border border-white/[0.06]">
                            {csv.rows.slice(0, 20).map((row, index) => (
                              <li
                                key={row.username + index}
                                className="flex items-center gap-2 px-2.5 py-1 text-[12px] odd:bg-white/[0.02]"
                              >
                                <span className="w-6 shrink-0 text-right font-mono text-[10px] text-white/20">
                                  {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-white/70">{row.username}</span>
                                <span className="tabular-nums text-white/50">
                                  {row.total_wagered.toLocaleString("en-US")}
                                </span>
                                <span className="w-20 shrink-0 text-right tabular-nums text-white/30">
                                  {row.total_earned.toLocaleString("en-US")}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => importCsv(true)}
                              disabled={busy}
                              className="inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:opacity-40"
                              style={{ backgroundColor: ACCENTS.purple }}
                            >
                              Replace all entries
                            </button>
                            <button
                              type="button"
                              onClick={() => importCsv(false)}
                              disabled={busy}
                              className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                            >
                              Add to existing
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>

      {showEntries && board && (
        <LeaderboardEntriesDialog
          leaderboard={{
            id: board.id,
            title: board.title,
            prize_pool: Number(board.prize_pool) || 0,
            payout_preset: board.payout_preset ?? board.prize_distribution_type,
            finalized_at: null,
          }}
          onClose={() => setShowEntries(false)}
        />
      )}
    </div>
  )
}
