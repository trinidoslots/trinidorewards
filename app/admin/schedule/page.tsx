"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, StatTile } from "@/components/ui/panel"
import { WeekGrid, WeekNav, groupWeek } from "@/components/schedule-week"
import { addWeeks, SEGMENT_COLORS, startOfWeek } from "@/lib/schedule-week"
import { SCHEDULE_CATEGORIES, stateOf, timeRange, type ScheduleEntry } from "@/lib/schedule"

/**
 * The schedule, built the way it is read.
 *
 * The same weekly grid the public page shows, with an add button in each
 * column — you fill in the week you are looking at rather than typing dates
 * into a form and hoping they land where you meant.
 *
 * Times go in as whatever the browser's clock says and are stored as instants,
 * so the public page can put them back into each viewer's own timezone.
 */

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

const COLUMNS =
  "id, title, description, starts_at, ends_at, category, url, is_cancelled, color, is_day_off, sort_order"

type Draft = { title: string; category: string; color: string; time: string; hours: string }

const emptyDraft: Draft = { title: "", category: "", color: "blue", time: "20:00", hours: "" }

export default function AdminSchedulePage() {
  const supabaseRef = useRef(createClient())

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [adding, setAdding] = useState<Date | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const from = addWeeks(weekStart, -1)
    const to = addWeeks(weekStart, 2)

    const { data, error: problem } = await supabaseRef.current
      .from("stream_schedule")
      .select(COLUMNS)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")

    if (problem) {
      console.error("[v0] Could not load the schedule:", problem)
      setError(problem.message || "Could not load the schedule")
    } else {
      setEntries((data ?? []) as ScheduleEntry[])
      setError(null)
    }
    setLoading(false)
  }, [weekStart])

  useEffect(() => {
    load()
  }, [load])

  const days = useMemo(() => groupWeek(weekStart, entries), [weekStart, entries])

  const totals = useMemo(() => {
    const now = Date.now()
    const segments = entries.filter((entry) => !entry.is_day_off)
    const upcoming = segments
      .filter((entry) => stateOf(entry, now) !== "past")
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    return {
      thisWeek: days.reduce((sum, day) => sum + day.entries.length, 0),
      daysOn: days.filter((day) => day.entries.length > 0).length,
      next: upcoming[0] ?? null,
    }
  }, [entries, days])

  function openAdd(date: Date) {
    // Pre-filled from whatever that day already starts at, so a second segment
    // does not need the time typed again.
    const existing = days.find((day) => day.date.getTime() === date.getTime())?.entries[0]
    const at = existing ? new Date(existing.starts_at) : null
    setDraft({
      ...emptyDraft,
      time: at
        ? `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`
        : emptyDraft.time,
    })
    setAdding(date)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!adding || !draft.title.trim()) return

    const [hours, minutes] = draft.time.split(":").map((part) => Number.parseInt(part, 10))
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      setError("That start time is not valid.")
      return
    }

    const starts = new Date(adding)
    starts.setHours(hours, minutes, 0, 0)

    const length = Number.parseFloat(draft.hours)
    const ends = Number.isFinite(length) && length > 0
      ? new Date(starts.getTime() + length * 3_600_000).toISOString()
      : null

    const day = days.find((entry) => entry.date.getTime() === adding.getTime())

    setBusy(true)
    const { error: problem } = await supabaseRef.current.from("stream_schedule").insert([
      {
        title: draft.title.trim(),
        category: draft.category.trim() || null,
        color: draft.color,
        starts_at: starts.toISOString(),
        ends_at: ends,
        // Appended to the day rather than inserted at the top: the order you
        // add them in is the order you mean to play them.
        sort_order: (day?.entries.length ?? 0) + 1,
        is_day_off: false,
      },
    ])
    setBusy(false)

    if (problem) {
      console.error("[v0] Could not add the segment:", problem)
      setError(problem.message || "Could not add that")
      return
    }
    setAdding(null)
    setDraft(emptyDraft)
    await load()
  }

  async function remove(entry: ScheduleEntry) {
    const { error: problem } = await supabaseRef.current.from("stream_schedule").delete().eq("id", entry.id)
    if (problem) {
      setError(problem.message || "Could not remove that")
      return
    }
    setEntries((current) => current.filter((row) => row.id !== entry.id))
  }

  async function toggleDayOff(date: Date, off: boolean) {
    const supabase = supabaseRef.current
    const day = days.find((entry) => entry.date.getTime() === date.getTime())

    if (!off) {
      // Turning it back on removes the marker, not the day's segments.
      const markers = entries.filter(
        (entry) => entry.is_day_off && new Date(entry.starts_at).toDateString() === date.toDateString(),
      )
      for (const marker of markers) await supabase.from("stream_schedule").delete().eq("id", marker.id)
      await load()
      return
    }

    if (day && day.entries.length > 0) {
      setError("That day has segments on it — remove them before marking it off.")
      return
    }

    const at = new Date(date)
    at.setHours(12, 0, 0, 0)
    const { error: problem } = await supabase
      .from("stream_schedule")
      .insert([{ title: "Day off", starts_at: at.toISOString(), is_day_off: true, color: "slate" }])

    if (problem) {
      setError(problem.message || "Could not mark that day off")
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Schedule</h1>
          <p className="mt-1 text-[13px] text-white/40">
            Fill in the week you are looking at. Everyone sees it in their own time.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {error && (
        <Panel accent="red" className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="ml-auto rounded p-1 text-white/25 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Segments this week" value={totals.thisWeek.toLocaleString()} accent="blue" />
        <StatTile label="Days on" value={`${totals.daysOn}/7`} accent="green" />
        <StatTile
          label="Next stream"
          value={totals.next ? timeRange(totals.next) : "—"}
          hint={totals.next ? new Date(totals.next.starts_at).toLocaleDateString() : "Nothing scheduled"}
        />
      </div>

      <Panel className="space-y-3 p-4">
        <WeekNav weekStart={weekStart} onShift={(weeks) => setWeekStart((current) => addWeeks(current, weeks))} />

        {loading ? (
          <div className="py-12 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : (
          <WeekGrid days={days} onAdd={openAdd} onRemove={remove} onToggleDayOff={toggleDayOff} />
        )}
      </Panel>

      {adding && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setAdding(null)}>
          <form
            onSubmit={save}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-lg border border-white/[0.10] bg-[#0E0E11]"
          >
            <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <MonoLabel className="text-white/70">Add to</MonoLabel>
              <span className="text-[13px] text-white/50">
                {adding.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
              </span>
              <button
                type="button"
                onClick={() => setAdding(null)}
                aria-label="Close"
                className="ml-auto rounded p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-3 p-4">
              <div>
                <MonoLabel className="mb-1.5 block text-white/30">What</MonoLabel>
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Bonus opening"
                  className={field}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <MonoLabel className="mb-1.5 block text-white/30">Starts</MonoLabel>
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                    className={field}
                  />
                </div>
                <div>
                  <MonoLabel className="mb-1.5 block text-white/30">Hours</MonoLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={draft.hours}
                    onChange={(event) => setDraft({ ...draft, hours: event.target.value })}
                    placeholder="Optional"
                    className={`${field} tabular-nums`}
                  />
                </div>
              </div>

              <div>
                <MonoLabel className="mb-1.5 block text-white/30">Category</MonoLabel>
                <input
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  list="schedule-categories"
                  placeholder="Optional"
                  className={field}
                />
                <datalist id="schedule-categories">
                  {SCHEDULE_CATEGORIES.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              <div>
                <MonoLabel className="mb-1.5 block text-white/30">Colour</MonoLabel>
                <div className="flex gap-1.5">
                  {SEGMENT_COLORS.map((color) => {
                    const active = draft.color === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setDraft({ ...draft, color })}
                        aria-label={color}
                        className="h-8 flex-1 rounded-md border transition"
                        style={{
                          borderColor: active ? ACCENTS[color] : "rgba(255,255,255,0.08)",
                          backgroundColor: active ? `${ACCENTS[color]}33` : `${ACCENTS[color]}14`,
                        }}
                      >
                        <span
                          className="mx-auto block h-2 w-2 rounded-full"
                          style={{ backgroundColor: ACCENTS[color] }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
              <button
                type="button"
                onClick={() => setAdding(null)}
                className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !draft.title.trim()}
                className="inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:opacity-30"
                style={{ backgroundColor: ACCENTS.blue }}
              >
                {busy ? "Saving…" : "Add"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  )
}
