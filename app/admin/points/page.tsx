"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Coins, RefreshCw, Users } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { createClient } from "@/lib/supabase/client"
import {
  DEFAULT_POINTS_EACH,
  DEFAULT_WINDOW_MINUTES,
  clampPointsEach,
  clampWindowMinutes,
  grantLabel,
} from "@/lib/points-activity"

/**
 * Points for everyone who has been talking.
 *
 * The list below is a preview and nothing more — the grant recomputes the
 * window in the database, so what is shown here cannot decide who gets paid.
 * See app/api/admin/points/grant.
 */

const REFRESH_MS = 10_000

type ActiveResponse = {
  windowMinutes: number
  recorder: { state: "live" | "stale" | "never"; lastMessageAt: string | null; tokenConfigured: boolean }
  active: number
  withAccount: { userId: string; kickId: string; username: string; balance: number }[]
  withoutAccount: { kickId: string; username: string }[]
}

const number = (value: number) => value.toLocaleString("en-US")

export default function AdminPointsPage() {
  const [windowMinutes, setWindowMinutes] = useState(DEFAULT_WINDOW_MINUTES)
  const [pointsEach, setPointsEach] = useState(DEFAULT_POINTS_EACH)
  const [data, setData] = useState<ActiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  // Settings load once; without this the first save would race the load and be
  // overwritten by the stored value a moment later.
  const settingsLoaded = useRef(false)

  useEffect(() => {
    const load = async () => {
      const { data: rows } = await supabaseRef.current
        .from("settings")
        .select("key, value")
        .in("key", ["points_active_window_minutes", "points_default_amount"])

      for (const row of rows ?? []) {
        if (row.key === "points_active_window_minutes") setWindowMinutes(clampWindowMinutes(row.value))
        if (row.key === "points_default_amount") setPointsEach(clampPointsEach(row.value))
      }
      settingsLoaded.current = true
    }
    void load()
  }, [])

  const saveSetting = useCallback(async (key: string, value: number) => {
    if (!settingsLoaded.current) return
    await supabaseRef.current.from("settings").upsert({ key, value: String(value) }, { onConflict: "key" })
  }, [])

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/points/active?window=${windowMinutes}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Could not read chat activity")
      setData(payload as ActiveResponse)
      setError(null)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not read chat activity")
    } finally {
      setLoading(false)
    }
  }, [windowMinutes])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const eligible = data?.withAccount ?? []
  const missing = data?.withoutAccount ?? []
  const recorder = data?.recorder

  const grant = useCallback(async () => {
    if (eligible.length === 0 || busy) return
    setBusy(true)
    setResult(null)

    try {
      const response = await fetch("/api/admin/points/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          windowMinutes,
          pointsEach,
          // Generated per press. A retry or a double-click replays the same key
          // and the server returns the first grant instead of making a second.
          idempotencyKey: crypto.randomUUID(),
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Could not grant points")

      setResult(
        payload.reused
          ? "That grant had already been applied — nothing was added twice."
          : `Gave ${grantLabel(payload.userCount, payload.pointsEach)} (${number(payload.totalPoints)} total).`,
      )
      await load()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not grant points")
    } finally {
      setBusy(false)
    }
  }, [eligible.length, busy, windowMinutes, pointsEach, load])

  const recorderTag = useMemo(() => {
    if (!recorder) return null
    if (!recorder.tokenConfigured) return { accent: "red" as const, text: "No token" }
    if (recorder.state === "live") return { accent: "green" as const, text: "Recording" }
    if (recorder.state === "stale") return { accent: "amber" as const, text: "Idle" }
    return { accent: "slate" as const, text: "Never" }
  }, [recorder])

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Points</h1>
          <p className="mt-1 text-[13px] text-white/40">
            Give points to everyone who has said something in chat recently.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </header>

      {/* The one failure the old version of this made invisible: nothing is
          recording, so the window is empty and a grant would reach nobody. */}
      {recorder && recorder.state !== "live" && (
        <Panel accent={recorder.tokenConfigured ? "amber" : "red"} className="flex items-start gap-3 p-4">
          <AlertTriangle
            className="mt-[2px] h-4 w-4 shrink-0"
            style={{ color: recorder.tokenConfigured ? ACCENTS.amber : ACCENTS.red }}
          />
          <div className="text-[13px] leading-relaxed text-white/60">
            {!recorder.tokenConfigured ? (
              <>
                <strong className="text-white/80">RECORDER_TOKEN is not set.</strong> Chat activity cannot be
                recorded at all until it is set in the project environment, and every grant would reach nobody.
              </>
            ) : recorder.state === "never" ? (
              <>
                <strong className="text-white/80">Nothing has ever been recorded.</strong> Open the stream
                overlay with <code className="text-white/70">?recorder=&lt;token&gt;</code> in its URL — that is
                the page that reads chat.
              </>
            ) : (
              <>
                <strong className="text-white/80">Nothing is recording right now.</strong> The last message was
                seen {recorder.lastMessageAt ? new Date(recorder.lastMessageAt).toLocaleString() : "a while ago"}.
                The overlay is probably closed.
              </>
            )}
          </div>
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Eligible" value={number(eligible.length)} accent="green" hint="In the window, has an account" />
        <StatTile label="No account" value={number(missing.length)} accent="slate" hint="In the window, gets nothing" />
        <StatTile
          label="Would give"
          value={number(eligible.length * pointsEach)}
          accent="pink"
          hint={`${number(pointsEach)} each`}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Grant"
          accent="pink"
          right={recorderTag ? <Tag accent={recorderTag.accent}>{recorderTag.text}</Tag> : undefined}
        />
        <div className="grid gap-4 p-4 sm:grid-cols-[160px_160px_1fr] sm:items-end">
          <div>
            <MonoLabel className="mb-1.5 block text-white/30">Window (minutes)</MonoLabel>
            <input
              type="number"
              min={1}
              max={1440}
              value={windowMinutes}
              onChange={(event) => setWindowMinutes(Number(event.target.value))}
              onBlur={() => {
                const next = clampWindowMinutes(windowMinutes)
                setWindowMinutes(next)
                void saveSetting("points_active_window_minutes", next)
              }}
              className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] tabular-nums text-white outline-none transition focus:border-white/25"
            />
          </div>

          <div>
            <MonoLabel className="mb-1.5 block text-white/30">Points each</MonoLabel>
            <input
              type="number"
              min={1}
              value={pointsEach}
              onChange={(event) => setPointsEach(Number(event.target.value))}
              onBlur={() => {
                const next = clampPointsEach(pointsEach)
                setPointsEach(next)
                void saveSetting("points_default_amount", next)
              }}
              className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] tabular-nums text-white outline-none transition focus:border-white/25"
            />
          </div>

          <button
            type="button"
            onClick={() => void grant()}
            disabled={busy || eligible.length === 0}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: ACCENTS.pink }}
          >
            <Coins className="h-3.5 w-3.5" />
            {busy ? "Granting…" : `Give ${grantLabel(eligible.length, clampPointsEach(pointsEach))}`}
          </button>
        </div>

        {(result || error) && (
          <div className="border-t border-white/[0.08] px-4 py-3 text-[13px]" style={{ color: error ? ACCENTS.red : ACCENTS.green }}>
            {error ?? result}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Getting points"
            accent="green"
            right={<span className="font-mono text-[11px] text-white/35">{number(eligible.length)}</span>}
          />
          <ChatterList
            empty={loading ? "Loading…" : "Nobody with an account has spoken in this window."}
            rows={eligible.map((entry) => ({
              key: entry.kickId,
              name: entry.username,
              detail: `${number(entry.balance)} pts`,
            }))}
          />
        </Panel>

        <Panel>
          <PanelHeader
            title="No account"
            accent="slate"
            right={<span className="font-mono text-[11px] text-white/35">{number(missing.length)}</span>}
          />
          <ChatterList
            empty={loading ? "Loading…" : "Everyone active in this window has an account."}
            rows={missing.map((entry) => ({ key: entry.kickId, name: entry.username, detail: "no account" }))}
          />
        </Panel>
      </div>
    </div>
  )
}

function ChatterList({ rows, empty }: { rows: { key: string; name: string; detail: string }[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-white/25">{empty}</p>
  }

  return (
    <ul className="max-h-[320px] divide-y divide-white/[0.05] overflow-y-auto">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2.5 px-4 py-2">
          <Users className="h-3.5 w-3.5 shrink-0 text-white/20" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-white/70">{row.name}</span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/30">{row.detail}</span>
        </li>
      ))}
    </ul>
  )
}
