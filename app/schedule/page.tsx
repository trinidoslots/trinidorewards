"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { CalendarDays, ExternalLink, Radio } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"
import { groupByDay, stateOf, timeRange, type ScheduleEntry } from "@/lib/schedule"

/**
 * When the stream is on.
 *
 * A client component on purpose: every time is rendered in the viewer's own
 * timezone, and doing that on the server would either pick one zone for
 * everybody or render one thing on the server and another in the browser.
 */
export default function SchedulePage() {
  const supabaseRef = useRef(createClient())

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Re-rendered on a timer so "Live now" appears without a refresh.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Yesterday onwards: a stream that started last night may still be live.
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error: problem } = await supabaseRef.current
        .from("stream_schedule")
        .select("id, title, description, starts_at, ends_at, category, url, is_cancelled")
        .gte("starts_at", from)
        .order("starts_at")

      if (cancelled) return
      if (problem) {
        console.error("[v0] Could not load the schedule:", problem)
        setError(problem.message || "The schedule could not be loaded")
      } else {
        setEntries((data ?? []) as ScheduleEntry[])
      }
      setLoading(false)
    })()

    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const upcoming = useMemo(
    () => entries.filter((entry) => stateOf(entry, now) !== "past"),
    [entries, now],
  )
  const days = useMemo(() => groupByDay(upcoming), [upcoming])
  const live = upcoming.find((entry) => !entry.is_cancelled && stateOf(entry, now) === "live") ?? null
  const next = upcoming.find((entry) => !entry.is_cancelled && stateOf(entry, now) === "upcoming") ?? null

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Schedule</h1>
        <p className="mt-1 text-[13px] text-white/40">
          All times in your own timezone{zone ? ` (${zone})` : ""}.
        </p>
      </header>

      {error ? (
        <Panel accent="red" className="p-6 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-[14px] text-white">The schedule could not be loaded.</p>
          <p className="mt-1 text-[12.5px] text-white/35">{error}</p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <StatTile
              label={live ? "On air" : "Next stream"}
              value={live ? live.title : next ? timeRange(next) : "—"}
              accent={live ? "green" : "blue"}
              hint={
                live
                  ? "Live now"
                  : next
                    ? new Date(next.starts_at).toLocaleDateString(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "Nothing announced yet"
              }
            />
            <StatTile label="Streams scheduled" value={upcoming.length.toLocaleString()} />
          </div>

          {loading ? (
            <Panel className="py-16 text-center">
              <MonoLabel className="text-white/25">Loading</MonoLabel>
            </Panel>
          ) : days.length === 0 ? (
            <Panel className="flex flex-col items-center gap-2 py-16">
              <CalendarDays className="h-8 w-8 text-white/10" />
              <p className="text-[13px] text-white/30">Nothing on the schedule yet.</p>
            </Panel>
          ) : (
            days.map((day) => (
              <section key={day.day} className="space-y-2.5">
                <MonoLabel className="text-white/30">{day.label}</MonoLabel>
                <Panel>
                  <ul className="divide-y divide-white/[0.05]">
                    {day.entries.map((entry) => {
                      const state = stateOf(entry, now)
                      const isLive = !entry.is_cancelled && state === "live"
                      return (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3"
                          style={{ opacity: entry.is_cancelled ? 0.45 : 1 }}
                        >
                          <div className="w-28 shrink-0">
                            <p
                              className="text-[14px] font-semibold tabular-nums"
                              style={{ color: isLive ? ACCENTS.green : "#E7E7EA" }}
                            >
                              {timeRange(entry)}
                            </p>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span
                                className="truncate text-[13.5px] text-white"
                                style={{ textDecoration: entry.is_cancelled ? "line-through" : undefined }}
                              >
                                {entry.title}
                              </span>
                              {entry.category && <MonoLabel className="text-white/25">{entry.category}</MonoLabel>}
                            </div>
                            {entry.description && (
                              <p className="truncate text-[12px] text-white/35">{entry.description}</p>
                            )}
                          </div>

                          {entry.is_cancelled ? (
                            <Tag accent="red">Cancelled</Tag>
                          ) : isLive ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                              style={{ color: ACCENTS.green, backgroundColor: `${ACCENTS.green}1f` }}
                            >
                              <Radio className="h-3 w-3" />
                              Live now
                            </span>
                          ) : null}

                          {entry.url && !entry.is_cancelled && (
                            <Link
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open ${entry.title}`}
                              className="shrink-0 rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </Panel>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}
