"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Ban, CalendarDays, Plus, RefreshCw, Save, Trash2, Undo2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { toInstant, toLocalInput } from "@/lib/datetime"
import { SCHEDULE_CATEGORIES, stateOf, timeRange, type ScheduleEntry } from "@/lib/schedule"

/**
 * The stream schedule, entered by hand.
 *
 * Times go in as whatever the browser's clock says and are stored as instants,
 * so the public page can put them back into each viewer's own timezone. Sending
 * the raw datetime-local string would have the database read it as UTC and the
 * stream would be announced at the wrong hour.
 */

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

type Draft = {
  title: string
  description: string
  category: string
  url: string
  starts_at: string
  ends_at: string
}

const emptyDraft: Draft = { title: "", description: "", category: "", url: "", starts_at: "", ends_at: "" }

export default function AdminSchedulePage() {
  const supabaseRef = useRef(createClient())

  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: problem } = await supabaseRef.current
      .from("stream_schedule")
      .select("id, title, description, starts_at, ends_at, category, url, is_cancelled")
      .order("starts_at", { ascending: false })

    if (problem) {
      console.error("[v0] Could not load the schedule:", problem)
      setError(problem.message || "Could not load the schedule")
    } else {
      setEntries((data ?? []) as ScheduleEntry[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const sorted = [...entries].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    return {
      upcoming: sorted.filter((entry) => stateOf(entry, now) !== "past"),
      past: sorted.filter((entry) => stateOf(entry, now) === "past").reverse(),
    }
  }, [entries])

  const set = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }))

  function editEntry(entry: ScheduleEntry) {
    setEditing(entry.id)
    setDraft({
      title: entry.title,
      description: entry.description ?? "",
      category: entry.category ?? "",
      url: entry.url ?? "",
      starts_at: toLocalInput(entry.starts_at),
      ends_at: toLocalInput(entry.ends_at),
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const starts = toInstant(draft.starts_at)
    if (!draft.title.trim() || !starts) {
      setError("A title and a start time are required.")
      return
    }
    const ends = toInstant(draft.ends_at)
    if (ends && new Date(ends) <= new Date(starts)) {
      setError("The stream has to end after it starts.")
      return
    }

    setBusy(true)
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      category: draft.category.trim() || null,
      url: draft.url.trim() || null,
      starts_at: starts,
      ends_at: ends,
      updated_at: new Date().toISOString(),
    }

    const supabase = supabaseRef.current
    const { error: problem } = editing
      ? await supabase.from("stream_schedule").update(payload).eq("id", editing)
      : await supabase.from("stream_schedule").insert([payload])

    setBusy(false)

    if (problem) {
      console.error("[v0] Could not save the entry:", problem)
      setError(problem.message || "Could not save that entry")
      return
    }
    setDraft(emptyDraft)
    setEditing(null)
    await load()
  }

  async function setCancelled(entry: ScheduleEntry, cancelled: boolean) {
    const { error: problem } = await supabaseRef.current
      .from("stream_schedule")
      .update({ is_cancelled: cancelled, updated_at: new Date().toISOString() })
      .eq("id", entry.id)

    if (problem) {
      setError(problem.message || "Could not update that entry")
      return
    }
    setEntries((current) =>
      current.map((row) => (row.id === entry.id ? { ...row, is_cancelled: cancelled } : row)),
    )
  }

  async function remove(entry: ScheduleEntry) {
    if (!confirm(`Delete "${entry.title}" from the schedule?`)) return
    const { error: problem } = await supabaseRef.current.from("stream_schedule").delete().eq("id", entry.id)
    if (problem) {
      setError(problem.message || "Could not delete that entry")
      return
    }
    setEntries((current) => current.filter((row) => row.id !== entry.id))
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Schedule</h1>
          <p className="mt-1 text-[13px] text-white/40">When you are on. Shown to everyone in their own time.</p>
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
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Coming up" value={upcoming.length.toLocaleString()} accent="green" />
        <StatTile label="Streamed" value={past.length.toLocaleString()} />
        <StatTile
          label="Next stream"
          value={upcoming[0] ? timeRange(upcoming[0]) : "—"}
          accent="blue"
          hint={upcoming[0] ? new Date(upcoming[0].starts_at).toLocaleDateString() : undefined}
        />
      </div>

      <Panel accent={editing ? "amber" : "blue"}>
        <PanelHeader
          title={editing ? "Edit entry" : "Add an entry"}
          accent={editing ? "amber" : "blue"}
          right={
            editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setDraft(emptyDraft)
                }}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/30 transition hover:text-white"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            ) : null
          }
        />
        <form onSubmit={save} className="space-y-3 p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <MonoLabel className="mb-1.5 block text-white/30">Title</MonoLabel>
              <input
                value={draft.title}
                onChange={(event) => set({ title: event.target.value })}
                placeholder="Friday bonus hunt"
                className={field}
              />
            </div>
            <div>
              <MonoLabel className="mb-1.5 block text-white/30">Category</MonoLabel>
              <input
                value={draft.category}
                onChange={(event) => set({ category: event.target.value })}
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
              <MonoLabel className="mb-1.5 block text-white/30">Starts</MonoLabel>
              <input
                type="datetime-local"
                value={draft.starts_at}
                onChange={(event) => set({ starts_at: event.target.value })}
                className={field}
              />
            </div>
            <div>
              <MonoLabel className="mb-1.5 block text-white/30">Ends</MonoLabel>
              <input
                type="datetime-local"
                value={draft.ends_at}
                onChange={(event) => set({ ends_at: event.target.value })}
                className={field}
              />
              <p className="mt-1 text-[11px] text-white/25">Optional — leave empty if you play it by ear.</p>
            </div>
            <div className="sm:col-span-2">
              <MonoLabel className="mb-1.5 block text-white/30">Description</MonoLabel>
              <input
                value={draft.description}
                onChange={(event) => set({ description: event.target.value })}
                placeholder="Optional"
                className={field}
              />
            </div>
            <div className="sm:col-span-2">
              <MonoLabel className="mb-1.5 block text-white/30">Link</MonoLabel>
              <input
                value={draft.url}
                onChange={(event) => set({ url: event.target.value })}
                placeholder="Optional — only if it is not the usual channel"
                className={field}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !draft.title.trim() || !draft.starts_at}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: editing ? ACCENTS.amber : ACCENTS.blue }}
          >
            {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {busy ? "Saving…" : editing ? "Save changes" : "Add to the schedule"}
          </button>
        </form>
      </Panel>

      <EntryList
        title="Coming up"
        entries={upcoming}
        loading={loading}
        empty="Nothing scheduled."
        onEdit={editEntry}
        onCancel={setCancelled}
        onDelete={remove}
      />
      <EntryList
        title="Past"
        entries={past}
        loading={loading}
        empty=""
        onEdit={editEntry}
        onCancel={setCancelled}
        onDelete={remove}
      />
    </div>
  )
}

function EntryList({
  title,
  entries,
  loading,
  empty,
  onEdit,
  onCancel,
  onDelete,
}: {
  title: string
  entries: ScheduleEntry[]
  loading: boolean
  empty: string
  onEdit: (entry: ScheduleEntry) => void
  onCancel: (entry: ScheduleEntry, cancelled: boolean) => void
  onDelete: (entry: ScheduleEntry) => void
}) {
  // A "Past" heading over nothing is noise on a fresh install.
  if (!loading && entries.length === 0 && !empty) return null

  return (
    <Panel>
      <PanelHeader
        title={title}
        accent="slate"
        right={<MonoLabel className="text-white/25">{entries.length}</MonoLabel>}
      />
      {loading ? (
        <div className="py-12 text-center">
          <MonoLabel className="text-white/25">Loading</MonoLabel>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <CalendarDays className="h-7 w-7 text-white/10" />
          <p className="text-[13px] text-white/30">{empty}</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {entries.map((entry) => {
            const state = stateOf(entry)
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5"
                style={{ opacity: entry.is_cancelled ? 0.45 : 1 }}
              >
                <div className="w-32 shrink-0">
                  <p className="text-[13px] font-medium text-white">{timeRange(entry)}</p>
                  <MonoLabel className="text-white/25">
                    {new Date(entry.starts_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </MonoLabel>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="truncate text-[13px] text-white"
                      style={{ textDecoration: entry.is_cancelled ? "line-through" : undefined }}
                    >
                      {entry.title}
                    </span>
                    {entry.category && <MonoLabel className="text-white/25">{entry.category}</MonoLabel>}
                  </div>
                  {entry.description && <p className="truncate text-[11px] text-white/30">{entry.description}</p>}
                </div>

                {entry.is_cancelled ? (
                  <Tag accent="red">Cancelled</Tag>
                ) : state === "live" ? (
                  <Tag accent="green">Live</Tag>
                ) : state === "upcoming" ? (
                  <Tag accent="blue">Upcoming</Tag>
                ) : (
                  <Tag accent="slate">Done</Tag>
                )}

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onCancel(entry, !entry.is_cancelled)}
                    aria-label={entry.is_cancelled ? `Restore ${entry.title}` : `Cancel ${entry.title}`}
                    className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    {entry.is_cancelled ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    className="rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/30 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(entry)}
                    aria-label={`Delete ${entry.title}`}
                    className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
