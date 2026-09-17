"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Save } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"
import { DURATION_UNITS, durationToMs, msToDuration, type DurationUnit } from "@/lib/raffle-utils"

/**
 * Create and edit share one form, so the two cannot drift apart on which
 * fields exist or what they mean.
 *
 * There is no start time: creating a raffle starts it. You say how long it
 * runs, and the closing time is worked out from that. Picking two datetimes
 * for something you want live in the next ten seconds was the slow part.
 *
 * entry_type is 'free' or 'points' — the column carries a CHECK constraint
 * with exactly those two values, and anything else is rejected outright.
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
  durationAmount: string
  durationUnit: DurationUnit
  featured: boolean
  /** Only set when editing: the raffle keeps the time it actually opened. */
  startedAt?: string
}

export const emptyDraft: RaffleDraft = {
  title: "",
  description: "",
  prize_name: "",
  prize_value: "",
  prize_image_url: "",
  ticket_price: "100",
  entry_type: "free",
  max_tickets: "",
  total_tickets_available: "",
  durationAmount: "24",
  durationUnit: "hours",
  featured: false,
}

/** Turns a stored raffle back into something this form can edit. */
export function draftFrom(row: Record<string, any>): RaffleDraft {
  const start = Date.parse(row.start_date)
  const end = Date.parse(row.end_date)
  const span = Number.isFinite(start) && Number.isFinite(end) ? end - start : 0
  const duration = msToDuration(span)

  return {
    title: row.title ?? "",
    description: row.description ?? "",
    prize_name: row.prize_name ?? "",
    prize_value: row.prize_value == null ? "" : String(row.prize_value),
    prize_image_url: row.prize_image_url ?? "",
    ticket_price: String(row.ticket_price ?? 0),
    entry_type: row.entry_type === "points" || Number(row.ticket_price) > 0 ? "points" : "free",
    max_tickets: row.max_tickets == null ? "" : String(row.max_tickets),
    total_tickets_available: row.total_tickets_available == null ? "" : String(row.total_tickets_available),
    durationAmount: String(duration.amount),
    durationUnit: duration.unit,
    featured: !!row.featured,
    startedAt: row.start_date ?? undefined,
  }
}

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

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

  const amount = Number.parseInt(draft.durationAmount, 10)
  const span = Number.isFinite(amount) && amount > 0 ? durationToMs(amount, draft.durationUnit) : 0
  // Edits keep the original opening time, so "runs for 2 days" stays measured
  // from when it actually went live rather than silently restarting it.
  const start = draft.startedAt ? new Date(draft.startedAt) : new Date()
  const closes = span > 0 ? new Date(start.getTime() + span) : null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!draft.title.trim() || !draft.prize_name.trim()) {
      setError("A title and a prize are required.")
      return
    }
    if (span <= 0) {
      setError("Say how long the raffle should run.")
      return
    }

    setBusy(true)
    const startIso = start.toISOString()
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      prize_name: draft.prize_name.trim(),
      prize_value: draft.prize_value ? Number.parseFloat(draft.prize_value) : null,
      prize_image_url: draft.prize_image_url.trim() || null,
      // A free raffle costs nothing whatever is left in the price box.
      ticket_price: isFree ? 0 : Number.parseInt(draft.ticket_price) || 0,
      entry_type: isFree ? "free" : "points",
      max_tickets: draft.max_tickets ? Number.parseInt(draft.max_tickets) : null,
      total_tickets_available: draft.total_tickets_available
        ? Number.parseInt(draft.total_tickets_available)
        : null,
      start_date: startIso,
      end_date: new Date(start.getTime() + span).toISOString(),
      featured: draft.featured,
    }

    const supabase = createBrowserClient()
    const { error: problem } = raffleId
      ? await supabase.from("raffles").update(payload).eq("id", raffleId)
      : await supabase.from("raffles").insert([{ ...payload, status: "active" }])

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
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Friday giveaway"
              className={field}
            />
          </Field>
          <Field label="Prize">
            <input
              value={draft.prize_name}
              onChange={(e) => set({ prize_name: e.target.value })}
              placeholder="$100 bonus"
              className={field}
            />
          </Field>
          <Field label="Prize value" hint="Optional.">
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.prize_value}
              onChange={(e) => set({ prize_value: e.target.value })}
              className={`${field} tabular-nums`}
            />
          </Field>
          <Field label="Prize image URL" hint="Optional.">
            <input
              value={draft.prize_image_url}
              onChange={(e) => set({ prize_image_url: e.target.value })}
              placeholder="https://…"
              className={field}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" hint="Optional.">
              <input
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
                className={field}
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel accent="amber">
        <PanelHeader
          title="Runs for"
          accent="amber"
          right={
            closes ? (
              <MonoLabel style={{ color: ACCENTS.amber }}>
                Closes {closes.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </MonoLabel>
            ) : null
          }
        />
        <div className="flex flex-wrap items-end gap-3 p-3.5">
          <div className="w-28">
            <input
              type="number"
              min="1"
              value={draft.durationAmount}
              onChange={(e) => set({ durationAmount: e.target.value })}
              className={`${field} tabular-nums`}
            />
          </div>
          <div className="w-36">
            <select
              value={draft.durationUnit}
              onChange={(e) => set({ durationUnit: e.target.value as DurationUnit })}
              className={field}
            >
              {DURATION_UNITS.map((unit) => (
                <option key={unit.id} value={unit.id} className="bg-[#121216]">
                  {unit.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[12px] text-white/35">
            {raffleId
              ? "Measured from when this raffle opened."
              : "It goes live the moment you save."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
          {/* The spans actually used, so the common case is one click. */}
          {[
            { amount: "30", unit: "minutes" as const, label: "30m" },
            { amount: "1", unit: "hours" as const, label: "1h" },
            { amount: "6", unit: "hours" as const, label: "6h" },
            { amount: "24", unit: "hours" as const, label: "24h" },
            { amount: "3", unit: "days" as const, label: "3d" },
            { amount: "7", unit: "days" as const, label: "7d" },
          ].map((preset) => {
            const active = draft.durationAmount === preset.amount && draft.durationUnit === preset.unit
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => set({ durationAmount: preset.amount, durationUnit: preset.unit })}
                className="rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition"
                style={
                  active
                    ? { borderColor: `${ACCENTS.amber}77`, backgroundColor: `${ACCENTS.amber}1f`, color: ACCENTS.amber }
                    : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                }
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel accent="green">
        <PanelHeader title="Entry" accent="green" />
        <div className="grid gap-3 p-3.5 sm:grid-cols-2">
          <Field label="Entry type">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "free", label: "Free" },
                { id: "points", label: "Points" },
              ].map((option) => {
                const active = draft.entry_type === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => set({ entry_type: option.id })}
                    className="h-9 rounded-md border font-mono text-[11px] uppercase tracking-[0.1em] transition"
                    style={
                      active
                        ? { borderColor: `${ACCENTS.green}77`, backgroundColor: `${ACCENTS.green}1f`, color: ACCENTS.green }
                        : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                    }
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Points per ticket" hint={isFree ? "Not charged while the raffle is free." : undefined}>
            <input
              type="number"
              min="0"
              value={isFree ? "0" : draft.ticket_price}
              disabled={isFree}
              onChange={(e) => set({ ticket_price: e.target.value })}
              className={`${field} tabular-nums disabled:opacity-40`}
            />
          </Field>
          <Field label="Max tickets per person" hint="Empty for no limit.">
            <input
              type="number"
              min="1"
              value={draft.max_tickets}
              onChange={(e) => set({ max_tickets: e.target.value })}
              placeholder="No limit"
              className={`${field} tabular-nums`}
            />
          </Field>
          <Field label="Total tickets available" hint="Empty for no cap.">
            <input
              type="number"
              min="1"
              value={draft.total_tickets_available}
              onChange={(e) => set({ total_tickets_available: e.target.value })}
              placeholder="No cap"
              className={`${field} tabular-nums`}
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
          className="inline-flex h-10 items-center rounded-md border border-white/[0.10] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-md px-5 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:opacity-40"
          style={{ backgroundColor: ACCENTS.green }}
        >
          <Save className="h-3.5 w-3.5" />
          {busy ? "Saving…" : raffleId ? "Save changes" : "Start the raffle"}
        </button>
      </div>
    </form>
  )
}
