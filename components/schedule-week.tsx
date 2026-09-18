"use client"

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { dayKey, isSameDay, localOffsetLabel, weekDays, weekLabel } from "@/lib/schedule-week"
import { timeRange, type ScheduleEntry } from "@/lib/schedule"

/**
 * The week, as seven columns.
 *
 * Shared by the public page and the admin so they cannot drift apart — the
 * admin is the same grid with an add button in each day and a bin on each
 * segment, rather than a second view of the same data that looks almost right.
 *
 * A column with nothing in it says "no stream"; a column marked off says "day
 * off". Those are different statements and the grid keeps them apart: one means
 * nothing is announced yet, the other means you are not on.
 */

export type DayGroup = {
  date: Date
  key: string
  entries: ScheduleEntry[]
  dayOff: boolean
  /** The day's own header time, taken from its first segment. */
  headline: string | null
}

export function groupWeek(weekStart: Date, entries: ScheduleEntry[]): DayGroup[] {
  const byDay = new Map<string, ScheduleEntry[]>()
  for (const entry of entries) {
    const key = dayKey(entry.starts_at)
    if (!key) continue
    byDay.set(key, [...(byDay.get(key) ?? []), entry])
  }

  return weekDays(weekStart).map((date) => {
    const key = dayKey(date)
    const all = (byDay.get(key) ?? []).sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || Date.parse(a.starts_at) - Date.parse(b.starts_at),
    )
    const dayOff = all.some((entry) => entry.is_day_off)
    const segments = all.filter((entry) => !entry.is_day_off)

    return {
      date,
      key,
      entries: segments,
      dayOff,
      headline: segments[0] ? timeRange(segments[0]) : null,
    }
  })
}

function accentOf(color: string | null | undefined): Accent {
  const named = (color ?? "blue") as Accent
  return named in ACCENTS ? named : "blue"
}

export function WeekNav({
  weekStart,
  onShift,
  right,
}: {
  weekStart: Date
  onShift: (weeks: number) => void
  right?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-[17px] font-semibold tracking-wide text-white">Weekly schedule</h2>
      <MonoLabel className="text-white/30">{weekLabel(weekStart)}</MonoLabel>

      <div className="ml-auto flex items-center gap-2">
        {right}
        <MonoLabel className="text-white/30">Local — {localOffsetLabel()}</MonoLabel>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onShift(-1)}
            aria-label="Previous week"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.10] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onShift(1)}
            aria-label="Next week"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.10] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function WeekGrid({
  days,
  onAdd,
  onRemove,
  onToggleDayOff,
}: {
  days: DayGroup[]
  /** Admin only. Given, each column gets an add button. */
  onAdd?: (date: Date) => void
  onRemove?: (entry: ScheduleEntry) => void
  onToggleDayOff?: (date: Date, off: boolean) => void
}) {
  const today = new Date()
  const admin = !!onAdd

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => {
        const isToday = isSameDay(day.date, today)
        return (
          <section
            key={day.key}
            className="flex min-h-[220px] flex-col rounded-lg border bg-white/[0.015] p-2.5"
            style={{
              // Today is outlined rather than filled: a filled column would
              // read as the busiest day rather than the current one.
              borderColor: isToday ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)",
            }}
          >
            <header className="mb-2 flex items-baseline gap-1.5">
              <MonoLabel className="text-white/25">
                {day.date.toLocaleDateString(undefined, { weekday: "short" })}
              </MonoLabel>
              <span className="text-[14px] font-semibold text-white/80">
                {day.date.getMonth() + 1}/{day.date.getDate()}
              </span>
              {day.headline && (
                <span className="ml-auto text-right text-[10px] leading-tight text-white/35">{day.headline}</span>
              )}
            </header>

            {day.dayOff ? (
              <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                <MonoLabel className="text-white/35">Day off</MonoLabel>
              </div>
            ) : day.entries.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <MonoLabel className="text-white/15">No stream</MonoLabel>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {day.entries.map((entry) => {
                  const accent = ACCENTS[accentOf(entry.color)]
                  return (
                    <li
                      key={entry.id}
                      className="group/seg flex items-center gap-2 rounded-md border px-2.5 py-2"
                      style={{
                        borderColor: `${accent}3d`,
                        backgroundColor: `${accent}14`,
                        textDecoration: entry.is_cancelled ? "line-through" : undefined,
                        opacity: entry.is_cancelled ? 0.45 : 1,
                      }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/85">
                        {entry.title}
                      </span>
                      {onRemove && (
                        <button
                          type="button"
                          onClick={() => onRemove(entry)}
                          aria-label={`Remove ${entry.title}`}
                          className="shrink-0 rounded p-0.5 text-white/0 transition group-hover/seg:text-white/30 hover:!text-[#E5484D]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {admin && (
              <div className="mt-auto flex gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => onAdd?.(day.date)}
                  className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] font-mono text-[10px] uppercase tracking-[0.08em] text-white/35 transition hover:border-white/25 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
                {onToggleDayOff && (
                  <button
                    type="button"
                    onClick={() => onToggleDayOff(day.date, !day.dayOff)}
                    title={day.dayOff ? "Back on" : "Mark the day off"}
                    className="inline-flex h-7 items-center rounded-md border border-white/[0.08] px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-white/35 transition hover:border-white/25 hover:text-white"
                  >
                    {day.dayOff ? "On" : "Off"}
                  </button>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
