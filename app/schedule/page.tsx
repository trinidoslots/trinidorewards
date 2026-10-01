"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { createClient } from "@/lib/supabase/client"
import { WeekControls, WeekGrid, WeekGridSkeleton, groupWeek, weekTitle } from "@/components/schedule-week"
import { addWeeks, countdownTo, dayKey, weekLabel, startOfWeek } from "@/lib/schedule-week"
import { ASSUMED_LENGTH_MS, stateOf, type ScheduleEntry } from "@/lib/schedule"
import { PageBody, PageHero, PageHeroSkeleton } from "@/components/page-hero"
import { KickButton, SectionHeading } from "@/components/landing/parts"

/**
 * When the stream is on.
 *
 * A client component on purpose: every time is rendered in the viewer's own
 * timezone, and doing that on the server would either pick one zone for
 * everybody or render one thing on the server and another in the browser.
 */

const COLUMNS = "id, title, description, starts_at, ends_at, category, url, is_cancelled, color, is_day_off, sort_order"

const isStream = (entry: ScheduleEntry) => !entry.is_day_off && !entry.is_cancelled

export default function SchedulePage() {
  const supabaseRef = useRef(createClient())

  // What the header is about — on air now, or next — read on its own, so
  // paging the grid to another week does not change the header.
  const [upcoming, setUpcoming] = useState<ScheduleEntry[] | null>(null)

  // Weeks already fetched, by their first day. Paging back to one is instant.
  const [weeks, setWeeks] = useState<Record<string, ScheduleEntry[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [now, setNow] = useState(() => Date.now())
  const weekKey = dayKey(weekStart)
  const known = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // From one stream-length back, so one that is running still counts.
      const { data, error: problem } = await supabaseRef.current
        .from("stream_schedule")
        .select(COLUMNS)
        .gte("starts_at", new Date(Date.now() - ASSUMED_LENGTH_MS * 4).toISOString())
        .order("starts_at")
        .limit(20)
      if (cancelled) return
      if (problem) console.error("[v0] Could not load the next stream:", problem)
      setUpcoming((data ?? []) as ScheduleEntry[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (known.current.has(weekKey)) return
    known.current.add(weekKey)
    ;(async () => {
      const { data, error: problem } = await supabaseRef.current
        .from("stream_schedule")
        .select(COLUMNS)
        .gte("starts_at", weekStart.toISOString())
        .lt("starts_at", addWeeks(weekStart, 1).toISOString())
        .order("starts_at")

      if (problem) {
        console.error("[v0] Could not load the schedule:", problem)
        known.current.delete(weekKey)
        setError("The schedule could not be loaded. Try again in a moment.")
        return
      }
      setError(null)
      setWeeks((current) => ({ ...current, [weekKey]: (data ?? []) as ScheduleEntry[] }))
    })()
  }, [weekKey, weekStart])

  // The countdown ticks; everything else is derived from it.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const entries = weeks[weekKey]
  const days = useMemo(() => groupWeek(weekStart, entries ?? []), [weekStart, entries])
  const streams = (entries ?? []).filter(isStream).length

  const live = useMemo(
    () => (upcoming ?? []).find((entry) => isStream(entry) && stateOf(entry, now) === "live") ?? null,
    [upcoming, now],
  )
  const next = useMemo(
    () => (upcoming ?? []).find((entry) => isStream(entry) && Date.parse(entry.starts_at) > now) ?? null,
    [upcoming, now],
  )
  const countdown = countdownTo(next?.starts_at, now)

  const when = (iso: string) => {
    const date = new Date(iso)
    const day = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
    const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    return `${day}, ${time} your time`
  }

  return (
    <div>
      {upcoming === null ? (
        <PageHeroSkeleton accent="purple" panel />
      ) : live ? (
        <PageHero
          accent="green"
          note="Live now"
          title={live.title || "On air"}
          subtitle={`Started ${new Date(live.starts_at).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}${live.category ? ` · ${live.category}` : ""}`}
          actions={<KickButton label="Watch live" />}
        />
      ) : next ? (
        <PageHero
          accent="purple"
          note="Next stream"
          title={next.title || "Stream"}
          subtitle={`${when(next.starts_at)}${next.category ? ` · ${next.category}` : ""}`}
          countdown={countdown.over ? undefined : countdown}
          countdownLabel="Starts in"
          actions={<KickButton label="Follow on Kick" />}
        />
      ) : (
        <PageHero
          accent="purple"
          note="Schedule"
          title="Nothing announced"
          subtitle="The next streams show up here as soon as they are planned, in your own timezone."
          actions={<KickButton label="Follow on Kick" />}
        />
      )}

      <PageBody className="space-y-8">
        <SectionHeading
          eyebrow={
            entries === undefined
              ? weekLabel(weekStart)
              : `${weekLabel(weekStart)} · ${streams} ${streams === 1 ? "stream" : "streams"}`
          }
          title={weekTitle(weekStart, now)}
          accent={ACCENTS.purple}
          right={<WeekControls weekStart={weekStart} onShift={(count) => setWeekStart((current) => addWeeks(current, count))} />}
        />

        {error && entries === undefined ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0E0E12] p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-[15px] font-semibold text-white">{error}</p>
          </div>
        ) : entries === undefined ? (
          <WeekGridSkeleton />
        ) : (
          <WeekGrid days={days} now={now} />
        )}
      </PageBody>
    </div>
  )
}
