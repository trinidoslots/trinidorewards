"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Loader2, RefreshCw } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"
import type { SlotSyncResult } from "@/lib/slots-sync"

/**
 * The daily bonushunt.gg sync on /admin/slots: when it last ran, what it
 * found, and a button to run it now. The sync itself is lib/slots-sync.ts.
 */

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
})

export function SlotSyncPanel({ onSynced }: { onSynced?: () => void }) {
  const [last, setLast] = useState<SlotSyncResult | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/slots/sync", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (res.ok) setLast(json.last ?? null)
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function runNow() {
    setRunning(true)
    setError(null)
    const res = await fetch("/api/admin/slots/sync", { method: "POST" })
    const json = await res.json().catch(() => null)
    setRunning(false)
    if (json && typeof json === "object" && "at" in json) setLast(json as SlotSyncResult)
    if (!res.ok) setError((json && json.error) || "The sync failed.")
    else onSynced?.()
  }

  return (
    <Panel accent="green">
      <PanelHeader
        title="Automatic daily sync"
        accent="green"
        right={<CalendarClock className="h-3.5 w-3.5 text-white/30" />}
      />
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-2 text-[13px] leading-relaxed text-white/55">
          <p>
            Every night (about 05:45) the slots Stake added in the last week are read from bonushunt.gg&apos;s public
            API and added here — artwork, Stake link and the Only on Stake tag included. Nothing is removed. The
            upload below stays the way to load the whole list.
          </p>
          {!loaded ? (
            <p className="text-white/35">Loading the last run…</p>
          ) : last ? (
            <div className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: last.ok ? ACCENTS.green : ACCENTS.red }}
                />
                <span className="text-white/80">
                  {last.ok ? "Last run" : "Last run failed"} · {dateFormat.format(new Date(last.at))}
                </span>
                <MonoLabel className="text-white/30">{last.trigger === "cron" ? "nightly" : "by hand"}</MonoLabel>
              </div>
              <p className="mt-1 text-[12.5px]">
                {last.added > 0 ? (
                  <>
                    <b style={{ color: ACCENTS.green }}>{last.added} new</b> of {last.found} recent Stake slots
                  </>
                ) : (
                  <>Up to date — all {last.found} recent Stake slots were already here</>
                )}
                {last.error && <span style={{ color: ACCENTS.red }}> · {last.error}</span>}
              </p>
              {last.newSlots.length > 0 && (
                <p className="mt-1 text-[12px] text-white/40">
                  {last.newSlots.slice(0, 12).join(", ")}
                  {last.added > 12 ? ` and ${last.added - 12} more` : ""}
                </p>
              )}
              <p className="mt-1 font-mono text-[10.5px] text-white/25">
                changes feed: {last.feeds.changes} · recent feed: {last.feeds.recent}
              </p>
            </div>
          ) : (
            <p className="text-white/35">Has not run yet.</p>
          )}
          {error && <p style={{ color: ACCENTS.red }}>{error}</p>}
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {running ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </Panel>
  )
}
