"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Clock, Copy, RefreshCw, X } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"
import { FIELD_CLASS } from "@/components/ui/select-menu"
import {
  describeTarget,
  isoToLocalInput,
  localInputToIso,
  STARTING_SOON_DEFAULTS,
  type StartingSoonRow,
} from "@/lib/starting-soon"

/**
 * The countdown on the "starting soon" screen.
 *
 * Saving goes through /api/admin/starting-soon rather than straight to the
 * table: starting_soon is readable by anyone (the OBS source has only the anon
 * key) but writable by nobody, so the route is what holds the service role.
 *
 * The overlay is subscribed to the row, so a save lands on stream within a
 * second — there is no "apply" step and nothing to reload in OBS.
 */

const QUICK_MINUTES = [5, 10, 15, 30, 45, 60]

type Draft = {
  startsAtLocal: string
  headline: string
  subline: string
  endedText: string
}

const emptyDraft: Draft = {
  startsAtLocal: "",
  headline: STARTING_SOON_DEFAULTS.headline,
  subline: "",
  endedText: STARTING_SOON_DEFAULTS.ended_text,
}

function draftFromRow(row: StartingSoonRow | null): Draft {
  if (!row) return emptyDraft
  return {
    startsAtLocal: isoToLocalInput(row.starts_at),
    headline: row.headline ?? STARTING_SOON_DEFAULTS.headline,
    subline: row.subline ?? "",
    endedText: row.ended_text ?? STARTING_SOON_DEFAULTS.ended_text,
  }
}

export default function StartingSoonAdmin() {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  // Ticks so the "in 12 minutes" line under the field stays honest while the
  // page is open, rather than freezing at whatever it said when you loaded it.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/starting-soon", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Could not load the countdown.")
      setDraft(draftFromRow(payload.row as StartingSoonRow | null))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the countdown.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (override?: Partial<Draft>) => {
    const next = { ...draft, ...override }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch("/api/admin/starting-soon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starts_at: localInputToIso(next.startsAtLocal),
          headline: next.headline,
          subline: next.subline,
          ended_text: next.endedText,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Could not save the countdown.")
      setDraft(draftFromRow(payload.row as StartingSoonRow))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the countdown.")
    } finally {
      setSaving(false)
    }
  }

  /** Sets the target to now + minutes and saves in one go — the common case. */
  const startIn = (minutes: number) => {
    const target = new Date(Date.now() + minutes * 60_000)
    // Dropped to the whole minute so the clock on stream starts at a round
    // number instead of at 09:47.
    target.setSeconds(0, 0)
    const local = isoToLocalInput(target.toISOString())
    setDraft((current) => ({ ...current, startsAtLocal: local }))
    void save({ startsAtLocal: local })
  }

  const clearTime = () => {
    setDraft((current) => ({ ...current, startsAtLocal: "" }))
    void save({ startsAtLocal: "" })
  }

  const obsUrl =
    typeof window === "undefined" ? "/obs/starting-soon" : `${window.location.origin}/obs/starting-soon`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(obsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not reach the clipboard — copy the URL by hand.")
    }
  }

  const targetIso = localInputToIso(draft.startsAtLocal)

  return (
    <div className="space-y-4 pb-10">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Starting soon</h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 py-1.5 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </header>

      <Panel accent="blue">
        <PanelHeader title="Countdown" />
        <div className="space-y-5 p-4">
          <div>
            <MonoLabel className="mb-2 block text-white/40">Start in</MonoLabel>
            <div className="flex flex-wrap gap-2">
              {QUICK_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => startIn(minutes)}
                  disabled={saving || loading}
                  className="rounded-md border border-white/[0.10] bg-black/40 px-3 py-1.5 text-[13px] text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                >
                  {minutes} min
                </button>
              ))}
              <button
                type="button"
                onClick={clearTime}
                disabled={saving || loading}
                className="flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-black/40 px-3 py-1.5 text-[13px] text-white/50 transition hover:border-white/25 hover:text-white/80 disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
                No clock
              </button>
            </div>
            <p className="mt-2 text-[11px] text-white/30">
              These set the time and save immediately. Seconds are dropped, so the clock starts on a round
              minute.
            </p>
          </div>

          <div>
            <MonoLabel className="mb-2 block text-white/40">Or an exact time</MonoLabel>
            <input
              type="datetime-local"
              value={draft.startsAtLocal}
              onChange={(event) => setDraft({ ...draft, startsAtLocal: event.target.value })}
              className={`${FIELD_CLASS} max-w-[280px]`}
            />
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/45">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {describeTarget(targetIso, now)}
            </p>
          </div>
        </div>
      </Panel>

      <Panel accent="purple">
        <PanelHeader title="Wording" accent="purple" />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <MonoLabel className="mb-2 block text-white/40">Headline</MonoLabel>
            <input
              value={draft.headline}
              onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
              placeholder={STARTING_SOON_DEFAULTS.headline}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <MonoLabel className="mb-2 block text-white/40">At zero</MonoLabel>
            <input
              value={draft.endedText}
              onChange={(event) => setDraft({ ...draft, endedText: event.target.value })}
              placeholder={STARTING_SOON_DEFAULTS.ended_text}
              className={FIELD_CLASS}
            />
            <p className="mt-2 text-[11px] text-white/30">
              Shown instead of counting into negative numbers once the time passes.
            </p>
          </div>
          <div className="md:col-span-2">
            <MonoLabel className="mb-2 block text-white/40">Subline (optional)</MonoLabel>
            <input
              value={draft.subline}
              onChange={(event) => setDraft({ ...draft, subline: event.target.value })}
              placeholder="Bonus hunt opening, leaderboard running all month"
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading}
          className="rounded-md px-4 py-2 text-[13px] font-medium text-black transition disabled:opacity-40"
          style={{ backgroundColor: ACCENTS.blue }}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-[12px]" style={{ color: ACCENTS.green }}>
            <Check className="h-3.5 w-3.5" />
            Saved — the overlay updates itself.
          </span>
        )}
        {error && (
          <span className="text-[12px]" style={{ color: ACCENTS.red }}>
            {error}
          </span>
        )}
      </div>

      <Panel>
        <PanelHeader title="OBS source" accent="slate" />
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-white/[0.10] bg-black/40 px-3 py-1.5 text-[12px] text-white/70">
              {obsUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 py-1.5 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/30">
            A 1920×1080 browser source, same as the combined overlay, and it shares the same background — so
            cutting between this scene and the stream scene does not change what is behind it. Add{" "}
            <code className="text-white/45">?preview=1</code> to see it with a sample countdown without
            touching what is saved.
          </p>
        </div>
      </Panel>
    </div>
  )
}
