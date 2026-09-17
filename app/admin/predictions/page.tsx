"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Crown, RefreshCw, Search, Target, Trash2, X } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { RecordWinDialog, WinnerName } from "@/components/admin/record-win-dialog"
import { rankAll, type Actuals, type Prediction } from "@/lib/predictions"

/**
 * Guess the balance: open the window, watch the picks land, read out the
 * winners.
 *
 * The three categories are scored and shown separately because they are
 * separate contests — being closest on the balance says nothing about whether
 * you also called the best game. Each podium is only drawn once that category
 * has a real result; a provisional winner is the kind of thing that gets read
 * out on stream and then has to be taken back.
 */

interface PredictionSettings {
  predictions_enabled: boolean
  predictions_start_time: string | null
  predictions_end_time: string | null
  actual_highest_multi: number | null
  actual_final_balance: number | null
  actual_best_game: string | null
  results_entered_at?: string | null
}

const emptySettings: PredictionSettings = {
  predictions_enabled: false,
  predictions_start_time: null,
  predictions_end_time: null,
  actual_highest_multi: null,
  actual_final_balance: null,
  actual_best_game: null,
  results_entered_at: null,
}

const PLACE_COLOURS = ["#E8C547", "#B9C0CC", "#C08552"]

function formatDate(value: string | null) {
  if (!value) return "Not recorded"
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function formatClock(seconds: number) {
  if (seconds <= 0) return "Closed"
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`
}

export default function PredictionsAdminPage() {
  const [submissions, setSubmissions] = useState<Prediction[]>([])
  const [settings, setSettings] = useState<PredictionSettings>(emptySettings)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [query, setQuery] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [windowBusy, setWindowBusy] = useState(false)
  const [winner, setWinner] = useState<{ username: string; category: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/predictions", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to load predictions")
      setSettings({ ...emptySettings, ...data.settings })
      setSubmissions(data.predictions || [])
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to load predictions" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const tick = () =>
      setSecondsLeft(
        settings.predictions_end_time
          ? Math.max(0, Math.floor((Date.parse(settings.predictions_end_time) - Date.now()) / 1000))
          : 0,
      )
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [settings.predictions_end_time])

  const actuals: Actuals = useMemo(
    () => ({
      highestMulti: settings.actual_highest_multi === null ? null : Number(settings.actual_highest_multi),
      finalBalance: settings.actual_final_balance === null ? null : Number(settings.actual_final_balance),
      bestGame: settings.actual_best_game || null,
    }),
    [settings],
  )

  const podiums = useMemo(() => rankAll(submissions, actuals), [submissions, actuals])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return submissions
    return submissions.filter(
      (submission) =>
        submission.username.toLowerCase().includes(needle) ||
        submission.predicted_best_game.toLowerCase().includes(needle),
    )
  }, [query, submissions])

  const windowOpen =
    settings.predictions_enabled &&
    secondsLeft > 0 &&
    (!settings.predictions_start_time || Date.now() >= Date.parse(settings.predictions_start_time))

  const resolvedCount = [settings.actual_highest_multi, settings.actual_final_balance, settings.actual_best_game].filter(
    (value) => value !== null && value !== "",
  ).length

  const setPredictionWindow = async (action: "open" | "close") => {
    setWindowBusy(true)
    try {
      const response = await fetch("/api/admin/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not update prediction window")
      setMessage({ type: "success", text: action === "open" ? "Predictions opened for 5 minutes." : "Predictions closed." })
      await load()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update prediction window" })
    } finally {
      setWindowBusy(false)
    }
  }

  const deletePrediction = async (id: string) => {
    if (!window.confirm("Delete this prediction permanently?")) return
    setBusy(id)
    try {
      const response = await fetch(`/api/admin/predictions/delete?id=${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Delete failed")
      }
      await load()
      setMessage({ type: "success", text: "Prediction deleted." })
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Delete failed" })
    } finally {
      setBusy(null)
    }
  }

  const resetRound = async () => {
    if (!window.confirm("Reset the current round, including predictions and resolved outcomes?")) return
    setBusy("reset")
    try {
      const response = await fetch("/api/admin/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Reset failed")
      await load()
      setMessage({ type: "success", text: "Round reset." })
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Reset failed" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Guess the Balance</h1>
          <p className="mt-1 text-[13px] text-white/40">
            Community picks, scored against the live hunt result.
          </p>
        </div>
        <div className="flex gap-2">
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
            onClick={resetRound}
            disabled={busy === "reset"}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-[#E5484D]/40 hover:text-[#E5484D] disabled:opacity-30"
          >
            <X className="h-3.5 w-3.5" />
            Reset round
          </button>
        </div>
      </header>

      {message && (
        <Panel
          accent={message.type === "success" ? "green" : "red"}
          className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]"
          style={{ color: message.type === "success" ? ACCENTS.green : ACCENTS.red }}
        >
          {message.type === "success" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {message.text}
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss"
            className="ml-auto rounded p-1 text-white/25 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Panel>
      )}

      <Panel accent={windowOpen ? "green" : "blue"} className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0">
          <MonoLabel className="text-white/30">Prediction window</MonoLabel>
          <p className="mt-1.5 text-[17px] font-semibold text-white">
            {windowOpen ? formatClock(secondsLeft) : "Closed"}
          </p>
          <p className="mt-0.5 text-[12px] text-white/35">
            Opening a round starts a five-minute countdown and drops a card on the stream overlay.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPredictionWindow(windowOpen ? "close" : "open")}
          disabled={windowBusy}
          className="ml-auto inline-flex h-10 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] transition disabled:opacity-40"
          style={
            windowOpen
              ? { border: `1px solid ${ACCENTS.red}55`, color: ACCENTS.red }
              : { backgroundColor: ACCENTS.blue, color: "#0B0B0D" }
          }
        >
          {windowBusy ? "Updating…" : windowOpen ? "Close predictions" : "Open for 5 minutes"}
        </button>
      </Panel>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Community picks" value={submissions.length.toLocaleString()} />
        <StatTile label="Results in" value={`${resolvedCount}/3`} accent={resolvedCount === 3 ? "green" : "amber"} />
        <StatTile
          label="Highest multiplier"
          value={settings.actual_highest_multi == null ? "—" : `${Number(settings.actual_highest_multi).toFixed(2)}x`}
          accent="amber"
        />
        <StatTile
          label="Final balance"
          value={
            settings.actual_final_balance == null
              ? "—"
              : `$${Number(settings.actual_final_balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
          }
          accent="green"
          hint={settings.actual_best_game ? `Best game: ${settings.actual_best_game}` : undefined}
        />
      </div>

      {/* Winners, one podium per category */}
      <div className="grid gap-3 lg:grid-cols-3">
        {podiums.map((category) => (
          <Panel key={category.id} accent={category.accent}>
            <PanelHeader
              title={category.label}
              accent={category.accent}
              right={
                <MonoLabel style={{ color: category.actual ? ACCENTS[category.accent] : "rgba(255,255,255,0.2)" }}>
                  {category.actual ?? "Pending"}
                </MonoLabel>
              }
            />
            {category.winners.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Target className="h-6 w-6 text-white/10" />
                <p className="px-4 text-[12px] text-white/30">
                  {category.actual
                    ? "Nobody called this one."
                    : "Waiting for the hunt result before anyone can be ranked."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {category.winners.map((row) => (
                  <li key={row.prediction.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold tabular-nums text-black"
                      style={{ backgroundColor: PLACE_COLOURS[row.place - 1] ?? "#3A3A42" }}
                    >
                      {row.place}
                    </span>
                    <WinnerName
                      username={row.prediction.username}
                      onClick={() => setWinner({ username: row.prediction.username, category: category.label })}
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-white"
                    />
                    <span className="shrink-0 text-[12px] tabular-nums text-white/60">{row.guess}</span>
                    {row.delta !== null && row.delta > 0 && (
                      <MonoLabel className="w-14 shrink-0 text-right text-white/20">
                        {row.delta < 1 ? row.delta.toFixed(2) : Math.round(row.delta).toLocaleString()} off
                      </MonoLabel>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHeader
          title="All submissions"
          accent="slate"
          right={
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search player or game…"
                className="h-8 w-full rounded-md border border-white/10 bg-black/40 pl-8 pr-2.5 text-[12.5px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
              />
            </div>
          }
        />

        {loading ? (
          <div className="py-16 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Target className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">
              {submissions.length === 0 ? "No picks in yet." : "Nothing matches that search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-left">
                  {["Player", "Multiplier", "Best game", "Balance", "Submitted", ""].map((column, index) => (
                    <th key={column || index} className="px-3.5 py-2.5 font-normal">
                      <MonoLabel className="text-white/30">{column}</MonoLabel>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((submission) => (
                  <tr key={submission.id} className="border-b border-white/[0.05] text-[13px] hover:bg-white/[0.03]">
                    <td className="px-3.5 py-2.5">
                      <WinnerName
                        username={submission.username}
                        onClick={() => setWinner({ username: submission.username, category: "Prediction" })}
                        className="font-medium text-white"
                      />
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums" style={{ color: ACCENTS.amber }}>
                      {Number(submission.predicted_max_multiplier).toFixed(2)}x
                    </td>
                    <td className="px-3.5 py-2.5" style={{ color: ACCENTS.blue }}>
                      {submission.predicted_best_game}
                    </td>
                    <td className="px-3.5 py-2.5 tabular-nums" style={{ color: ACCENTS.green }}>
                      ${Number(submission.predicted_end_balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-2.5 text-[12px] text-white/25">{formatDate(submission.created_at)}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Delete ${submission.username} prediction`}
                        onClick={() => deletePrediction(submission.id)}
                        disabled={busy === submission.id}
                        className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D] disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-white/[0.08] px-3.5 py-2">
          <Crown className="h-3 w-3 text-white/20" />
          <MonoLabel className="text-white/25">Click a name to record a win · last result {formatDate(settings.results_entered_at || null)}</MonoLabel>
        </div>
      </Panel>

      {winner && (
        <RecordWinDialog
          username={winner.username}
          source="prediction"
          sourceRef={winner.category}
          onClose={() => setWinner(null)}
        />
      )}
    </div>
  )
}
