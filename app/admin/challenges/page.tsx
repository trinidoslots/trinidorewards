"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ExternalLink, Flag, Gamepad2, Inbox, Loader2, Pencil, Plus, RefreshCw, Target, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { FIELD_CLASS } from "@/components/ui/select-menu"
import { SlotCombobox } from "@/components/admin/slot-combobox"
import {
  minBetLabel,
  phaseOf,
  prizeLabel,
  targetLabel,
  type Challenge,
  type Phase,
  type SubmissionStatus,
} from "@/lib/challenges"
import { siteHref } from "@/lib/site-url"

/**
 * Slot challenges: set them up, end them, see how many claims wait.
 *
 * Reads and writes with the admin's own session; challenges and
 * challenge_submissions both have an admin policy (scripts/083). Claims are
 * reviewed on /admin/challenges/submissions.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const TABS: { id: Phase; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Ended" },
]

type Counts = { approved: number; pending: number }

type Draft = {
  slot_name: string
  provider: string | null
  image_url: string | null
  target_type: "multiplier" | "payout"
  target_value: string
  min_bet: string
  prize_amount: string
  prize_type: "cash" | "points"
  max_winners: string
  starts_at: string
  ends_at: string
  notes: string
}

/** A timestamp as the value of a datetime-local input, in the browser's zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyDraft(): Draft {
  return {
    slot_name: "",
    provider: null,
    image_url: null,
    target_type: "multiplier",
    target_value: "",
    min_bet: "",
    prize_amount: "",
    prize_type: "cash",
    max_winners: "1",
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: "",
    notes: "",
  }
}

function draftFrom(challenge: Challenge): Draft {
  return {
    slot_name: challenge.slot_name,
    provider: challenge.provider,
    image_url: challenge.image_url,
    target_type: challenge.target_type,
    target_value: String(challenge.target_value),
    min_bet: Number(challenge.min_bet) > 0 ? String(challenge.min_bet) : "",
    prize_amount: String(challenge.prize_amount),
    prize_type: challenge.prize_type,
    max_winners: challenge.max_winners ? String(challenge.max_winners) : "",
    starts_at: toLocalInput(challenge.starts_at),
    ends_at: toLocalInput(challenge.ends_at),
    notes: challenge.notes ?? "",
  }
}

/** The row to write, or the reason it cannot be. */
function rowFrom(draft: Draft): { row: Record<string, unknown> } | { problem: string } {
  const target = Number(draft.target_value)
  const minBet = draft.min_bet.trim() ? Number(draft.min_bet) : 0
  const prize = Number(draft.prize_amount)
  const winners = draft.max_winners.trim() ? Number(draft.max_winners) : null
  const starts = Date.parse(draft.starts_at)
  const ends = draft.ends_at ? Date.parse(draft.ends_at) : null

  if (!draft.slot_name.trim()) return { problem: "Pick a slot." }
  if (!(target > 0)) return { problem: "The target has to be more than 0." }
  if (!(minBet >= 0)) return { problem: "The minimum bet cannot be negative." }
  if (!(prize >= 0) || !draft.prize_amount.trim()) return { problem: "Set a prize." }
  if (winners !== null && !(Number.isInteger(winners) && winners > 0)) return { problem: "Winners must be a whole number, or empty for no limit." }
  if (!Number.isFinite(starts)) return { problem: "Set a start time." }
  if (ends !== null && !(ends > starts)) return { problem: "The end has to be after the start." }

  return {
    row: {
      slot_name: draft.slot_name.trim(),
      provider: draft.provider,
      image_url: draft.image_url,
      target_type: draft.target_type,
      target_value: target,
      min_bet: minBet,
      prize_amount: prize,
      prize_type: draft.prize_type,
      max_winners: winners,
      starts_at: new Date(starts).toISOString(),
      ends_at: ends === null ? null : new Date(ends).toISOString(),
      notes: draft.notes.trim() || null,
    },
  }
}

export default function AdminChallengesPage() {
  const supabaseRef = useRef(createClient())
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [counts, setCounts] = useState<Record<string, Counts>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Phase>("active")
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const client = supabaseRef.current
    const [{ data, error: problem }, { data: subs }] = await Promise.all([
      client.from("challenges").select("*").order("starts_at", { ascending: false }),
      client.from("challenge_submissions").select("challenge_id, status"),
    ])
    if (problem) {
      setError(
        problem.message.includes("does not exist")
          ? "The challenges tables are missing. Run scripts/083_challenges.sql in Supabase."
          : problem.message,
      )
    } else {
      setChallenges((data ?? []) as Challenge[])
      const next: Record<string, Counts> = {}
      for (const row of (subs ?? []) as { challenge_id: string; status: SubmissionStatus }[]) {
        const entry = (next[row.challenge_id] ??= { approved: 0, pending: 0 })
        if (row.status === "approved") entry.approved++
        if (row.status === "pending") entry.pending++
      }
      setCounts(next)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!confirmDelete) return
    const timer = setTimeout(() => setConfirmDelete(null), 3500)
    return () => clearTimeout(timer)
  }, [confirmDelete])

  const withPhase = useMemo(
    () => challenges.map((challenge) => ({ challenge, phase: phaseOf(challenge, counts[challenge.id]?.approved ?? 0) })),
    [challenges, counts],
  )
  const perTab = (id: Phase) => withPhase.filter((entry) => entry.phase === id)
  const shown = perTab(tab)
  const pendingTotal = Object.values(counts).reduce((sum, entry) => sum + entry.pending, 0)

  async function endNow(challenge: Challenge) {
    setBusy(`${challenge.id}:end`)
    const endedAt = new Date().toISOString()
    const { error: problem } = await supabaseRef.current
      .from("challenges")
      .update({ ended_at: endedAt, updated_at: endedAt })
      .eq("id", challenge.id)
    setBusy(null)
    if (problem) return setError(problem.message)
    setChallenges((current) => current.map((entry) => (entry.id === challenge.id ? { ...entry, ended_at: endedAt } : entry)))
  }

  async function remove(challenge: Challenge) {
    if (confirmDelete !== challenge.id) return setConfirmDelete(challenge.id)
    setConfirmDelete(null)
    setBusy(`${challenge.id}:delete`)
    const { error: problem } = await supabaseRef.current.from("challenges").delete().eq("id", challenge.id)
    setBusy(null)
    if (problem) return setError(problem.message)
    setChallenges((current) => current.filter((entry) => entry.id !== challenge.id))
  }

  async function save(draft: Draft): Promise<string | null> {
    const built = rowFrom(draft)
    if ("problem" in built) return built.problem
    const client = supabaseRef.current
    if (editing && editing !== "new") {
      const { data, error: problem } = await client
        .from("challenges")
        .update({ ...built.row, updated_at: new Date().toISOString() })
        .eq("id", editing)
        .select("*")
        .single()
      if (problem || !data) return problem?.message ?? "Could not save the challenge."
      setChallenges((current) => current.map((entry) => (entry.id === editing ? (data as Challenge) : entry)))
    } else {
      const { data, error: problem } = await client.from("challenges").insert(built.row).select("*").single()
      if (problem || !data) return problem?.message ?? "Could not create the challenge."
      setChallenges((current) => [data as Challenge, ...current])
    }
    setEditing(null)
    return null
  }

  const editingChallenge = editing && editing !== "new" ? (challenges.find((entry) => entry.id === editing) ?? null) : null

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Challenges</h1>
          <p className="mt-1 text-[13px] text-white/40">Slot challenges viewers claim on the Challenges page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={siteHref("/challenges")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View page
          </a>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition hover:brightness-110"
            style={{ backgroundColor: ACCENTS.green }}
          >
            <Plus className="h-3.5 w-3.5" />
            New challenge
          </button>
        </div>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-4">
        <StatTile label="Active" value={perTab("active").length} accent="green" />
        <StatTile label="Upcoming" value={perTab("upcoming").length} accent="blue" />
        <StatTile label="Ended" value={perTab("completed").length} accent="slate" />
        <Link href="/admin/challenges/submissions" className="block transition hover:brightness-125">
          <StatTile label="Claims to review" value={pendingTotal} accent={pendingTotal > 0 ? "amber" : "slate"} />
        </Link>
      </div>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Challenges"
          accent="purple"
          right={
            <div className="flex gap-1 rounded-md border border-white/[0.08] bg-black/30 p-0.5">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="relative rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors"
                  style={{ color: tab === id ? "#fff" : "rgba(255,255,255,0.4)" }}
                >
                  {tab === id && (
                    <motion.span layoutId="admin-challenge-tab" className="absolute inset-0 rounded bg-white/[0.10]" transition={{ duration: 0.25, ease: EASE }} />
                  )}
                  <span className="relative">
                    {label} {perTab(id).length}
                  </span>
                </button>
              ))}
            </div>
          }
        />

        {loading && challenges.length === 0 ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.length === 0 && (
                <motion.li
                  key={`none-${tab}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-2 py-12 text-[13px] text-white/30"
                >
                  <Target className="h-6 w-6 text-white/10" />
                  {tab === "active" ? "No active challenges." : tab === "upcoming" ? "Nothing scheduled." : "No ended challenges."}
                </motion.li>
              )}
              {shown.map(({ challenge, phase }) => {
                const count = counts[challenge.id] ?? { approved: 0, pending: 0 }
                return (
                  <motion.li
                    key={challenge.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.26, ease: EASE }}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-3.5 py-3"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]">
                      {challenge.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- slot artwork from the catalogue
                        <img src={challenge.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Gamepad2 className="h-4 w-4 text-white/15" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 basis-56">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13.5px] font-medium text-white">{challenge.slot_name}</span>
                        <Tag accent="purple">{targetLabel(challenge)}</Tag>
                        {phase === "completed" && challenge.ended_at && <Tag accent="slate">Ended by hand</Tag>}
                      </div>
                      <p className="mt-1 text-[12px] text-white/40">
                        {challenge.provider ? `${challenge.provider} · ` : ""}min bet {minBetLabel(Number(challenge.min_bet))} ·{" "}
                        <span style={{ color: ACCENTS.green }}>{prizeLabel(challenge)}</span> · winners {count.approved}
                        {challenge.max_winners ? `/${challenge.max_winners}` : ""}
                      </p>
                      <MonoLabel className="mt-1 block text-white/25">
                        {new Date(challenge.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        {" → "}
                        {challenge.ends_at
                          ? new Date(challenge.ends_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                          : "no end"}
                      </MonoLabel>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {count.pending > 0 && (
                        <Link
                          href={`/admin/challenges/submissions?challenge=${challenge.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition hover:brightness-125"
                          style={{ color: ACCENTS.amber, borderColor: `${ACCENTS.amber}55`, backgroundColor: `${ACCENTS.amber}14` }}
                        >
                          <Inbox className="h-3.5 w-3.5" />
                          {count.pending} to review
                        </Link>
                      )}
                      {phase !== "completed" && (
                        <button
                          type="button"
                          onClick={() => endNow(challenge)}
                          disabled={busy === `${challenge.id}:end`}
                          title="End it now"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 text-[12px] text-white/55 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                        >
                          {busy === `${challenge.id}:end` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                          End now
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(challenge.id)}
                        title="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-white/35 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(challenge)}
                        disabled={busy === `${challenge.id}:delete`}
                        title={confirmDelete === challenge.id ? "Click again: deletes it and its claims" : "Delete"}
                        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-white/35 transition hover:bg-white/[0.05] hover:text-[#E5484D]"
                        style={confirmDelete === challenge.id ? { color: ACCENTS.red, backgroundColor: `${ACCENTS.red}1a` } : undefined}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {confirmDelete === challenge.id && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Confirm</span>
                        )}
                      </button>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </Panel>

      <ChallengeEditor
        open={editing !== null}
        isNew={editing === "new"}
        initial={editingChallenge ? draftFrom(editingChallenge) : emptyDraft()}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </div>
  )
}

function ChallengeEditor({
  open,
  isNew,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  isNew: boolean
  initial: Draft
  onClose: () => void
  onSave: (draft: Draft) => Promise<string | null>
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    setDraft(initial)
    setProblem(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when it opens
  }, [open])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setProblem(await onSave(draft))
    setSaving(false)
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="challenge-editor"
          className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="w-full max-w-2xl rounded-lg border border-white/[0.10] bg-[#0E0E12] shadow-2xl shadow-black/60"
          >
            <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isNew ? ACCENTS.green : ACCENTS.blue }} />
              <MonoLabel className="text-white/70">{isNew ? "New challenge" : "Edit challenge"}</MonoLabel>
              <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Slot" wide>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]">
                    {draft.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- slot artwork from the catalogue
                      <img src={draft.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Gamepad2 className="h-4 w-4 text-white/15" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SlotCombobox
                      value={draft.slot_name}
                      onChange={(name, provider, imageUrl) =>
                        setDraft((current) => ({ ...current, slot_name: name, provider, image_url: imageUrl ?? null }))
                      }
                      placeholder="Search the slot database…"
                    />
                  </div>
                </div>
                {draft.provider && <p className="mt-1 text-[11px] text-white/30">{draft.provider}</p>}
              </Field>

              <Field label="Target" wide>
                <div className="flex gap-2">
                  <div className="flex shrink-0 gap-1 rounded-md border border-white/[0.08] bg-black/30 p-0.5">
                    {(["multiplier", "payout"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set("target_type", type)}
                        className="relative rounded px-3 py-1.5 text-[12px] transition-colors"
                        style={{ color: draft.target_type === type ? "#fff" : "rgba(255,255,255,0.45)" }}
                      >
                        {draft.target_type === type && (
                          <motion.span layoutId="target-type" className="absolute inset-0 rounded bg-white/[0.10]" transition={{ duration: 0.2, ease: EASE }} />
                        )}
                        <span className="relative">{type === "multiplier" ? "Multiplier (x)" : "Win amount ($)"}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    value={draft.target_value}
                    onChange={(e) => set("target_value", e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    placeholder={draft.target_type === "multiplier" ? "1000" : "500"}
                    className={FIELD_CLASS}
                  />
                </div>
              </Field>

              <Field label="Min bet ($)">
                <input value={draft.min_bet} onChange={(e) => set("min_bet", e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Any" className={FIELD_CLASS} />
              </Field>
              <Field label="Winners">
                <input value={draft.max_winners} onChange={(e) => set("max_winners", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="No limit" className={FIELD_CLASS} />
              </Field>

              <Field label="Prize" wide>
                <div className="flex gap-2">
                  <input value={draft.prize_amount} onChange={(e) => set("prize_amount", e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="50" className={FIELD_CLASS} />
                  <div className="flex shrink-0 gap-1 rounded-md border border-white/[0.08] bg-black/30 p-0.5">
                    {(["cash", "points"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set("prize_type", type)}
                        className="relative rounded px-3 py-1.5 text-[12px] transition-colors"
                        style={{ color: draft.prize_type === type ? "#fff" : "rgba(255,255,255,0.45)" }}
                      >
                        {draft.prize_type === type && (
                          <motion.span layoutId="prize-type" className="absolute inset-0 rounded bg-white/[0.10]" transition={{ duration: 0.2, ease: EASE }} />
                        )}
                        <span className="relative">{type === "cash" ? "$ Cash" : "Points"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Field>

              <Field label="Starts">
                <input type="datetime-local" value={draft.starts_at} onChange={(e) => set("starts_at", e.target.value)} className={`${FIELD_CLASS} [color-scheme:dark]`} />
              </Field>
              <Field label="Ends (optional)">
                <input type="datetime-local" value={draft.ends_at} onChange={(e) => set("ends_at", e.target.value)} className={`${FIELD_CLASS} [color-scheme:dark]`} />
              </Field>

              <Field label="Notes (shown on the card)" wide>
                <textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Stake only. One claim per person." className={`${FIELD_CLASS} h-auto resize-y py-2`} />
              </Field>
            </div>

            <footer className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-3">
              {problem && (
                <p className="text-[12.5px]" style={{ color: ACCENTS.red }}>
                  {problem}
                </p>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={onClose} className="h-9 rounded-md border border-white/[0.10] px-4 text-[13px] text-white/60 transition hover:border-white/25 hover:text-white">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
                  style={{ backgroundColor: isNew ? ACCENTS.green : ACCENTS.blue }}
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isNew ? "Create challenge" : "Save changes"}
                </button>
              </div>
            </footer>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <MonoLabel className="mb-1.5 block text-white/40">{label}</MonoLabel>
      {children}
    </div>
  )
}
