"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { CalendarDays, Radio } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
import { WeekGrid, WeekNav, groupWeek } from "@/components/schedule-week"
import { addWeeks, countdownTo, startOfWeek } from "@/lib/schedule-week"
import { stateOf, type ScheduleEntry } from "@/lib/schedule"

/**
 * When the stream is on.
 *
 * A client component on purpose: every time is rendered in the viewer's own
 * timezone, and doing that on the server would either pick one zone for
 * everybody or render one thing on the server and another in the browser.
 */

const KICK_URL = "https://kick.com/trinidoslots"

export default function SchedulePage() {
  const supabaseRef = useRef(createClient())

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [now, setNow] = useState(() => Date.now())

  // Loaded a fortnight either side of the week on screen, so paging back and
  // forth does not fetch on every click.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const from = addWeeks(weekStart, -1)
      const to = addWeeks(weekStart, 2)

      const { data, error: problem } = await supabaseRef.current
        .from("stream_schedule")
        .select("id, title, description, starts_at, ends_at, category, url, is_cancelled, color, is_day_off, sort_order")
        .gte("starts_at", from.toISOString())
        .lt("starts_at", to.toISOString())
        .order("starts_at")

      if (cancelled) return
      if (problem) {
        console.error("[v0] Could not load the schedule:", problem)
        setError(problem.message || "The schedule could not be loaded")
      } else {
        setEntries((data ?? []) as ScheduleEntry[])
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [weekStart])

  // The countdown ticks; everything else is derived from it.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const days = useMemo(() => groupWeek(weekStart, entries), [weekStart, entries])

  const next = useMemo(() => {
    const upcoming = entries
      .filter((entry) => !entry.is_day_off && !entry.is_cancelled && Date.parse(entry.starts_at) > now)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    return upcoming[0] ?? null
  }, [entries, now])

  const live = useMemo(
    () => entries.find((entry) => !entry.is_day_off && !entry.is_cancelled && stateOf(entry, now) === "live") ?? null,
    [entries, now],
  )

  const countdown = countdownTo(next?.starts_at, now)

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-6">
      <Panel accent={live ? "green" : "amber"} className="flex flex-wrap items-center gap-6 p-5">
        <div className="min-w-0">
          <MonoLabel style={{ color: live ? ACCENTS.green : ACCENTS.amber }}>
            {live ? "On air now" : "Next stream"}
          </MonoLabel>

          <p className="mt-1.5 text-[24px] font-semibold leading-tight text-white">
            {live
              ? live.title
              : next
                ? new Date(next.starts_at).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                : "Nothing announced"}
          </p>

          <p className="mt-0.5 text-[12.5px] text-white/40">
            {live
              ? "Live right now"
              : next
                ? new Date(next.starts_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                : "Check back soon"}
          </p>

          <Link
            href={KICK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.12] px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <Radio className="h-3 w-3" />
            Open Kick
          </Link>
        </div>

        {!live && next && !countdown.over && (
          <div className="ml-auto flex gap-2">
            {[
              { value: countdown.days, label: "Days" },
              { value: countdown.hours, label: "Hrs" },
              { value: countdown.minutes, label: "Min" },
              { value: countdown.seconds, label: "Sec" },
            ].map((part) => (
              <div
                key={part.label}
                className="w-[58px] rounded-md border border-white/[0.08] bg-black/40 px-2 py-2.5 text-center"
              >
                <p className="text-[19px] font-bold leading-none tabular-nums text-white">
                  {String(part.value).padStart(2, "0")}
                </p>
                <MonoLabel className="mt-1.5 block text-white/25">{part.label}</MonoLabel>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="space-y-3 p-4">
        <WeekNav weekStart={weekStart} onShift={(weeks) => setWeekStart((current) => addWeeks(current, weeks))} />

        {error ? (
          <div className="py-12 text-center">
            <CalendarDays className="mx-auto h-7 w-7 text-white/10" />
            <p className="mt-2 text-[13px] text-white/30">{error}</p>
          </div>
        ) : loading ? (
          <div className="py-12 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : (
          <WeekGrid days={days} />
        )}
      </Panel>
    </div>
  )
}
