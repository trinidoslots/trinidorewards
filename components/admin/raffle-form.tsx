"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Save } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"

/**
 * Create and edit share one form, so the two cannot drift apart on which
 * fields exist or what they mean.
 *
 * Dates are handled as the browser's local time and stored as an instant. The
 * datetime-local input has no zone, so sending the raw string would have the
 * database read it as UTC and a raffle would open at the wrong hour.
 */

export type RaffleDraft = {
  title: string
  description: string
  prize_name: string
  prize_value: string
  prize_image_url: string
  ticket_price: string
  entry_type: string
  max_tickets: string
  total_tickets_available: string
  start_date: string
  end_date: string
  draw_date: string
  featured: boolean
}

export const emptyDraft: RaffleDraft = {
  title: "",
  description: "",
  prize_name: "",
  prize_value: "",
  prize_image_url: "",
  ticket_price: "0",
  entry_type: "free",
  max_tickets: "",
  total_tickets_available: "",
  start_date: "",
  end_date: "",
  draw_date: "",
  featured: false,
}

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

/** A local datetime-local value as an instant, or null when left empty. */
export function toInstant(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** An instant back into the shape datetime-local expects, in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/25">{hint}</p>}
    </div>
  )
}

export function RaffleForm({ raffleId, initial }: { raffleId?: string; initial?: RaffleDraft }) {
  const router = useRouter()
  const [draft, setDraft] = useState<RaffleDraft>(initial ?? emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (changes: Partial<RaffleDraft>) => setDraft((current) => ({ ...current, ...changes }))
  const isFree = draft.entry_type === "free"

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!draft.title.trim() || !draft.prize_name.trim()) {
      setError("A title and a prize are required.")
      return
    }
    const start = toInstant(draft.start_date)
    const end = toInstant(draft.end_date)
    if (!start || !end) {
      setError("Both an opening and a closing time are required.")
      return
    }
    if (new Date(end) <= new Date(start)) {
      setError("The raffle has to close after it opens.")
      return
    }

    setBusy(true)
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      prize_name: draft.prize_name.trim(),
      prize_value: draft.prize_value ? Number.parseFloat(draft.prize_value) : null,
      prize_image_url: draft.prize_image_url.trim() || null,
      // A free raffle costs nothing whatever is typed in the price box.
      ticket_price: isFree ? 0 : Number.parseInt(draft.ticket_price) || 0,
      entry_type: draft.entry_type,
      max_tickets: draft.max_tickets ? Number.parseInt(draft.max_tickets) : null,
      total_tickets_available: draft.total_tickets_available
        ? Number.parseInt(draft.total_tickets_available)
        : null,
      start_date: start,
      end_date: end,
      draw_date: toInstant(draft.draw_date),
      featured: draft.featured,
    }

    const supabase = createBrowserClient()
    const { error: problem } = raffleId
      ? await supabase.from("raffles").update(payload).eq("id", raffleId)
      : await supabase.from("raffles").insert([{ ...payload, status: "upcoming" }])

    setBusy(false)

    if (problem) {
      console.error("[v0] Could not save raffle:", problem)
      setError(problem.message || "Could not save that raffle")
      return
    }
    router.push("/admin/raffles/active")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <Panel accent="blue">
        <PanelHeader title="The raffle" />
        <div className="grid gap-3 p-3.5 sm:grid-cols-2">
          <Field label="Title">
            <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={field} />
          </Field>
          <Field label="Prize">
            <input value={draft.prize_name} onChange={(e) => set({ prize_name: e.target.value })} className={field} />
          </Field>
          <Field label="Prize value" hint="Shown to entrants. Optional.">
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.prize_value}
              onChange={(e) => set({ prize_value: e.target.value })}
              className={`${field} tabular-nums`}
            />
          </Field>
          <Field label="Prize image URL">
            <input
              value={draft.prize_image_url}
              onChange={(e) => set({ prize_image_url: e.target.value })}
              placeholder="https://…"
              className={field}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-white/[0.10] bg-black/40 px-3 py-2 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel accent="green">
        <PanelHeader title="Entry" accent="green" />
        <div className="grid gap-3 p-3.5 sm:grid-cols-2">
          <Field label="Entry type">
            <select
              value={draft.entry_type}
              onChange={(e) => set({ entry_type: e.target.value })}
              className={field}
            >
              <option value="free" className="bg-[#121216]">Free</option>
              <option value="paid" className="bg-[#121216]">Points</option>
            </select>
          </Field>
          <Field label="Points per ticket" hint={isFree ? "Ignored while the raffle is free." : undefined}>
            <input
              type="number"
              min="0"
              value={isFree ? "0" : draft.ticket_price}
              disabled={isFree}
              onChange={(e) => set({ ticket_price: e.target.value })}
              className={`${field} tabular-nums disabled:opacity-40`}
            />
          </Field>
          <Field label="Max tickets per person" hint="Leave empty for no limit.">
            <input
              type="number"
              min="1"
              value={draft.max_tickets}
              onChange={(e) => set({ max_tickets: e.target.value })}
              className={`${field} tabular-nums`}
            />
          </Field>
          <Field label="Total tickets available" hint="Leave empty for no cap.">
            <input
              type="number"
              min="1"
              value={draft.total_tickets_available}
              onChange={(e) => set({ total_tickets_available: e.target.value })}
              className={`${field} tabular-nums`}
            />
          </Field>
        </div>
      </Panel>

      <Panel accent="amber">
        <PanelHeader title="Timing" accent="amber" />
        <div className="grid gap-3 p-3.5 sm:grid-cols-3">
          <Field label="Opens">
            <input
              type="datetime-local"
              value={draft.start_date}
              onChange={(e) => set({ start_date: e.target.value })}
              className={field}
            />
          </Field>
          <Field label="Closes">
            <input
              type="datetime-local"
              value={draft.end_date}
              onChange={(e) => set({ end_date: e.target.value })}
              className={field}
            />
          </Field>
          <Field label="Draw" hint="Optional — when you plan to draw it.">
            <input
              type="datetime-local"
              value={draft.draw_date}
              onChange={(e) => set({ draw_date: e.target.value })}
              className={field}
            />
          </Field>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 px-3.5 pb-3.5 text-[13px] text-white/60">
          <input
            type="checkbox"
            checked={draft.featured}
            onChange={(e) => set({ featured: e.target.checked })}
            className="h-3.5 w-3.5 accent-[#E8A33D]"
          />
          Feature this raffle
        </label>
      </Panel>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/admin/raffles/active")}
          className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:opacity-40"
          style={{ backgroundColor: ACCENTS.blue }}
        >
          <Save className="h-3.5 w-3.5" />
          {busy ? "Saving…" : raffleId ? "Save changes" : "Create raffle"}
        </button>
      </div>
    </form>
  )
}
