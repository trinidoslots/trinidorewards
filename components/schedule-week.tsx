"use client"

import type React from "react"
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { LiveDot } from "@/components/landing/parts"
import { DAY_MS, dayKey, isSameDay, localOffsetLabel, startOfWeek, weekDays, weekLabel } from "@/lib/schedule-week"
import { stateOf, timeRange, type ScheduleEntry } from "@/lib/schedule"

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
  const named = (color ?? "purple") as Accent
  return named in ACCENTS ? named : "purple"
}

/** Whole weeks between the week on screen and the current one. */
export function weeksFromNow(weekStart: Date, now = Date.now()): number {
  return Math.round((weekStart.getTime() - startOfWeek(new Date(now)).getTime()) / (7 * DAY_MS))
}

/** "This week", "Next week", "Last week", or the dates for anything further. */
export function weekTitle(weekStart: Date, now = Date.now()): string {
  const offset = weeksFromNow(weekStart, now)
  if (offset === 0) return "This week"
  if (offset === 1) return "Next week"
  if (offset === -1) return "Last week"
  return weekLabel(weekStart)
}

const navButton =
  "flex h-9 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.03] text-white/60 transition hover:border-white/30 hover:text-white disabled:pointer-events-none disabled:opacity-30"

/** Previous / this week / next, with the viewer's timezone beside them. */
export function WeekControls({ weekStart, onShift }: { weekStart: Date; onShift: (weeks: number) => void }) {
  const offset = weeksFromNow(weekStart)
  return (
    <div className="flex items-center gap-3">
      <MonoLabel className="hidden text-white/35 sm:block">Your time · {localOffsetLabel()}</MonoLabel>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onShift(-1)} aria-label="Previous week" className={`${navButton} w-9`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onShift(-offset)}
          disabled={offset === 0}
          className={`${navButton} px-3 text-[13px] font-semibold`}
        >
          This week
        </button>
        <button type="button" onClick={() => onShift(1)} aria-label="Next week" className={`${navButton} w-9`}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** The compact heading row the admin puts above its grid. */
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
      <h2 className="text-[17px] font-bold text-white">{weekTitle(weekStart)}</h2>
      <MonoLabel className="text-white/35">{weekLabel(weekStart)}</MonoLabel>
      <div className="ml-auto flex items-center gap-2">
        {right}
        <WeekControls weekStart={weekStart} onShift={onShift} />
      </div>
    </div>
  )
}

/** Seven placeholder columns in the grid's own shape, for the first load. */
export function WeekGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 xl:gap-3.5">
      {Array.from({ length: 7 }, (_, index) => (
        <div
          key={index}
          className="h-[76px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025] sm:h-[160px] xl:h-[300px]"
        />
      ))}
    </div>
  )
}

function Segment({
  entry,
  now,
  onRemove,
}: {
  entry: ScheduleEntry
  now: number
  onRemove?: (entry: ScheduleEntry) => void
}) {
  const accent = ACCENTS[accentOf(entry.color)]
  const state = entry.is_cancelled ? "cancelled" : stateOf(entry, now)
  const live = state === "live"

  const body = (
    <>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: live ? ACCENTS.green : accent }} />
      <div className="flex items-center gap-1.5">
        {live ? (
          <>
            <LiveDot color={ACCENTS.green} size={6} />
            <MonoLabel style={{ color: ACCENTS.green }}>Live</MonoLabel>
          </>
        ) : state === "cancelled" ? (
          <MonoLabel style={{ color: ACCENTS.red }}>Cancelled</MonoLabel>
        ) : (
          <span className="text-[12px] font-medium tabular-nums text-white/55">{timeRange(entry)}</span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              onRemove(entry)
            }}
            aria-label={`Remove ${entry.title}`}
            className="ml-auto shrink-0 rounded p-0.5 text-white/0 transition group-hover/seg:text-white/35 hover:!text-[#E5484D] focus-visible:text-white/35"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p
        className={`mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug ${
          state === "cancelled" ? "text-white/40 line-through" : "text-white"
        }`}
      >
        {entry.title || "Stream"}
      </p>
      {entry.category && <p className="mt-1 truncate text-[11.5px] text-white/40">{entry.category}</p>}
    </>
  )

  const className = `group/seg relative block overflow-hidden rounded-lg border py-3 pl-4 pr-3 transition ${
    state === "past" ? "opacity-45" : ""
  }`
  const style = {
    borderColor: live ? `${ACCENTS.green}55` : `${accent}30`,
    backgroundColor: live ? `${ACCENTS.green}14` : `${accent}0d`,
  }

  return (
    <li title={entry.description ?? undefined}>
      {entry.url && !onRemove ? (
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${className} hover:brightness-125`}
          style={style}
        >
          {body}
        </a>
      ) : (
        <div className={className} style={style}>
          {body}
        </div>
      )}
    </li>
  )
}

export function WeekGrid({
  days,
  now = Date.now(),
  onAdd,
  onRemove,
  onToggleDayOff,
}: {
  days: DayGroup[]
  /** Passed by a page that ticks, so a segment turns live without a reload. */
  now?: number
  /** Admin only. Given, each column gets an add button. */
  onAdd?: (date: Date) => void
  onRemove?: (entry: ScheduleEntry) => void
  onToggleDayOff?: (date: Date, off: boolean) => void
}) {
  const today = new Date(now)
  const admin = !!onAdd
  const purple = ACCENTS.purple

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 xl:gap-3.5">
      {days.map((day) => {
        const isToday = isSameDay(day.date, today)
        const isPast = !isToday && day.date.getTime() < today.getTime()
        const quiet = day.dayOff || day.entries.length === 0
        return (
          <section
            key={day.key}
            // A row on phones (date on the left, streams beside it) so an
            // empty day costs one line rather than a tall empty card; a
            // column from sm up, where the week reads across.
            className={`relative flex gap-4 overflow-hidden rounded-xl border bg-[#0E0E12] p-3.5 sm:flex-col sm:gap-3.5 xl:min-h-[300px] xl:p-4 ${
              isPast && quiet ? "opacity-60" : ""
            }`}
            style={{
              // Today is outlined rather than filled: a filled column would
              // read as the busiest day rather than the current one.
              borderColor: isToday ? `${purple}66` : "rgba(255,255,255,0.08)",
              boxShadow: isToday ? `0 0 0 1px ${purple}22, 0 20px 50px -30px ${purple}` : undefined,
            }}
          >
            {isToday && (
              <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: purple }} />
            )}

            <header className="flex w-12 shrink-0 flex-col sm:w-auto sm:flex-row sm:items-start sm:justify-between">
              <div>
                <MonoLabel style={{ color: isToday ? purple : "rgba(255,255,255,0.4)" }}>
                  {day.date.toLocaleDateString(undefined, { weekday: "short" })}
                </MonoLabel>
                <p className="mt-1 flex items-baseline gap-1.5 leading-none">
                  <span className="text-[26px] font-black tabular-nums tracking-[-0.02em] text-white">
                    {day.date.getDate()}
                  </span>
                  <span className="hidden text-[12px] font-medium text-white/35 sm:inline">
                    {day.date.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                </p>
              </div>
              {isToday && (
                <span
                  className="mt-0.5 hidden rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] sm:inline-block"
                  style={{ color: purple, backgroundColor: `${purple}1f` }}
                >
                  Today
                </span>
              )}
            </header>

            <div className="flex min-w-0 flex-1 flex-col">
              {day.dayOff ? (
                <div
                  className="flex flex-1 items-center justify-center rounded-lg border border-white/[0.07] px-3 py-3 sm:min-h-[64px]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 6px, transparent 6px 12px)",
                  }}
                >
                  <MonoLabel className="text-white/45">Day off</MonoLabel>
                </div>
              ) : day.entries.length === 0 ? (
                <div className="flex flex-1 items-center rounded-lg border border-dashed border-white/[0.07] px-3 py-3 sm:min-h-[64px] sm:justify-center">
                  <MonoLabel className="text-white/25">No stream</MonoLabel>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {day.entries.map((entry) => (
                    <Segment key={entry.id} entry={entry} now={now} onRemove={onRemove} />
                  ))}
                </ul>
              )}

              {admin && (
                <div className="mt-auto flex gap-1.5 pt-3">
                  <button
                    type="button"
                    onClick={() => onAdd?.(day.date)}
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.10] text-[12px] font-semibold text-white/50 transition hover:border-white/30 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                  {onToggleDayOff && (
                    <button
                      type="button"
                      onClick={() => onToggleDayOff(day.date, !day.dayOff)}
                      title={day.dayOff ? "Back on" : "Mark the day off"}
                      className="inline-flex h-8 items-center rounded-md border border-white/[0.10] px-2.5 text-[12px] font-semibold text-white/50 transition hover:border-white/30 hover:text-white"
                    >
                      {day.dayOff ? "On" : "Off"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
