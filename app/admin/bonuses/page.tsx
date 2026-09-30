"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  Copy,
  ExternalLink,
  Gift,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { FIELD_CLASS } from "@/components/ui/select-menu"
import { BonusCard, type Bonus } from "@/components/bonus-card"

/**
 * The offers on /bonuses.
 *
 * Rebuilt from the v0 page, which put a permanent form above an unsearchable
 * list and hid state behind an edit click: whether an offer was live or
 * featured could only be changed by opening it. Now the list is the page,
 * both switches sit on each row, and editing happens in a dialog with a live
 * preview of the card as visitors will see it.
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

type Draft = {
  title: string
  casino_name: string
  value: string
  code: string
  description: string
  terms: string
  casino_url: string
  image_url: string
  is_active: boolean
  featured: boolean
}

const EMPTY: Draft = {
  title: "",
  casino_name: "",
  value: "",
  code: "",
  description: "",
  terms: "",
  casino_url: "",
  image_url: "",
  is_active: true,
  featured: false,
}

type Filter = "all" | "live" | "hidden" | "featured"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "hidden", label: "Hidden" },
  { id: "featured", label: "Featured" },
]

/**
 * Only web links. The card renders casino_url as the Claim button and
 * image_url as an <img>, so a javascript: or data: value would be a link that
 * runs code for whoever clicks it.
 */
function webUrlProblem(value: string, label: string): string | null {
  if (!value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol === "https:" || url.protocol === "http:") return null
  } catch {
    // falls through
  }
  return `${label} must be a full http(s) link.`
}

function draftFrom(bonus: Bonus): Draft {
  return {
    title: bonus.title,
    casino_name: bonus.casino_name ?? "",
    value: bonus.value ?? "",
    code: bonus.code ?? "",
    description: bonus.description ?? "",
    terms: bonus.terms ?? "",
    casino_url: bonus.casino_url ?? "",
    image_url: bonus.image_url ?? "",
    is_active: bonus.is_active,
    featured: bonus.featured,
  }
}

/** Empty strings go to the database as null, the way the public page expects. */
function rowFrom(draft: Draft) {
  const orNull = (value: string) => value.trim() || null
  return {
    title: draft.title.trim(),
    casino_name: orNull(draft.casino_name),
    value: orNull(draft.value),
    code: orNull(draft.code),
    description: orNull(draft.description),
    terms: orNull(draft.terms),
    casino_url: orNull(draft.casino_url),
    image_url: orNull(draft.image_url),
    is_active: draft.is_active,
    featured: draft.featured,
  }
}

export default function AdminBonusesPage() {
  const supabaseRef = useRef(createClient())
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  /** null: closed. "new": creating. Otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: problem } = await supabaseRef.current
      .from("bonuses")
      .select("*")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
    if (problem) setError(problem.message || "Could not load bonuses")
    else {
      setBonuses((data ?? []) as Bonus[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // A delete needs a second click within a few seconds; anything else resets it.
  useEffect(() => {
    if (!confirmDelete) return
    const timer = setTimeout(() => setConfirmDelete(null), 3500)
    return () => clearTimeout(timer)
  }, [confirmDelete])

  const live = bonuses.filter((bonus) => bonus.is_active).length
  const featured = bonuses.filter((bonus) => bonus.is_active && bonus.featured).length

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return bonuses.filter((bonus) => {
      if (filter === "live" && !bonus.is_active) return false
      if (filter === "hidden" && bonus.is_active) return false
      if (filter === "featured" && !bonus.featured) return false
      if (!needle) return true
      return [bonus.title, bonus.casino_name, bonus.code, bonus.value]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle))
    })
  }, [bonuses, filter, query])

  async function patch(bonus: Bonus, changes: Partial<Bonus>, what: string) {
    setBusy(`${bonus.id}:${what}`)
    const { error: problem } = await supabaseRef.current
      .from("bonuses")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", bonus.id)
    setBusy(null)
    if (problem) {
      setError(problem.message || "Could not update that bonus")
      return
    }
    setBonuses((current) => current.map((entry) => (entry.id === bonus.id ? { ...entry, ...changes } : entry)))
    setError(null)
  }

  async function remove(bonus: Bonus) {
    if (confirmDelete !== bonus.id) {
      setConfirmDelete(bonus.id)
      return
    }
    setConfirmDelete(null)
    setBusy(`${bonus.id}:delete`)
    const { error: problem } = await supabaseRef.current.from("bonuses").delete().eq("id", bonus.id)
    setBusy(null)
    if (problem) {
      setError(problem.message || "Could not delete that bonus")
      return
    }
    setBonuses((current) => current.filter((entry) => entry.id !== bonus.id))
    setError(null)
  }

  /** Returns an error message, or null when saved. */
  async function save(draft: Draft): Promise<string | null> {
    const row = rowFrom(draft)
    if (!row.title) return "A title is needed."
    const problem = webUrlProblem(draft.casino_url, "The claim link") ?? webUrlProblem(draft.image_url, "The image")
    if (problem) return problem

    const client = supabaseRef.current
    if (editing && editing !== "new") {
      const { data, error: failed } = await client
        .from("bonuses")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", editing)
        .select("*")
        .single()
      if (failed || !data) return failed?.message || "Could not save that bonus"
      setBonuses((current) => current.map((entry) => (entry.id === editing ? (data as Bonus) : entry)))
    } else {
      const { data, error: failed } = await client.from("bonuses").insert(row).select("*").single()
      if (failed || !data) return failed?.message || "Could not create that bonus"
      setBonuses((current) => [data as Bonus, ...current])
    }
    setEditing(null)
    return null
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied((current) => (current === code ? null : current)), 1200)
    } catch {
      // Clipboard blocked; the code is on screen anyway.
    }
  }

  const editingBonus = editing && editing !== "new" ? (bonuses.find((bonus) => bonus.id === editing) ?? null) : null

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Bonuses</h1>
          <p className="mt-1 text-[13px] text-white/40">Casino offers and codes on the public Bonuses page.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/bonuses"
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
            New bonus
          </button>
        </div>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Live on the page" value={live.toLocaleString()} accent="green" />
        <StatTile label="Featured" value={featured.toLocaleString()} accent="amber" />
        <StatTile label="Hidden" value={(bonuses.length - live).toLocaleString()} accent="slate" />
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <Panel accent="red" className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-white/40 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      <Panel>
        <PanelHeader
          title="Offers"
          accent="slate"
          right={<MonoLabel className="text-white/25">{shown.length} shown</MonoLabel>}
        />

        <div className="flex flex-col gap-2.5 border-b border-white/[0.06] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-md border border-white/[0.08] bg-black/30 p-1">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className="relative rounded px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors duration-200"
                style={{ color: filter === id ? "#fff" : "rgba(255,255,255,0.4)" }}
              >
                {filter === id && (
                  <motion.span
                    layoutId="bonus-filter"
                    className="absolute inset-0 rounded bg-white/[0.10]"
                    transition={{ duration: 0.25, ease: EASE }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              aria-label="Search bonuses"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, casino or code"
              className={`${FIELD_CLASS} pl-9`}
            />
          </div>
        </div>

        {loading && bonuses.length === 0 ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : bonuses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14">
            <Gift className="h-8 w-8 text-white/10" />
            <p className="text-[13px] text-white/35">No bonuses yet.</p>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.10] px-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/60 transition hover:border-white/25 hover:text-white"
            >
              <Plus className="h-3 w-3" />
              Create the first one
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.length === 0 && (
                <motion.li
                  key="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-10 text-center text-[13px] text-white/30"
                >
                  Nothing matches.
                </motion.li>
              )}
              {shown.map((bonus) => (
                <motion.li
                  key={bonus.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.26, ease: EASE }}
                  className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-3.5 py-3"
                >
                  <div className="h-11 w-16 shrink-0 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]">
                    {bonus.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- casino artwork from any host
                      <img src={bonus.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Gift className="h-4 w-4 text-white/15" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-white">{bonus.title}</span>
                      {bonus.is_active ? <Tag accent="green">Live</Tag> : <Tag accent="slate">Hidden</Tag>}
                      {bonus.featured && <Tag accent="amber">Featured</Tag>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-white/40">
                      {bonus.casino_name && <MonoLabel className="text-white/35">{bonus.casino_name}</MonoLabel>}
                      {bonus.value && <span style={{ color: ACCENTS.green }}>{bonus.value}</span>}
                      {bonus.code && (
                        <button
                          type="button"
                          onClick={() => copy(bonus.code!)}
                          title="Copy code"
                          className="inline-flex items-center gap-1 font-mono text-[11.5px] text-white/60 hover:text-white"
                        >
                          {bonus.code}
                          {copied === bonus.code ? (
                            <Check className="h-3 w-3" style={{ color: ACCENTS.green }} />
                          ) : (
                            <Copy className="h-3 w-3 text-white/25" />
                          )}
                        </button>
                      )}
                      {!bonus.casino_url && <span className="text-white/25">no claim link</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <RowToggle
                      on={bonus.is_active}
                      busy={busy === `${bonus.id}:active`}
                      onClick={() => patch(bonus, { is_active: !bonus.is_active }, "active")}
                      onLabel="Live"
                      offLabel="Hidden"
                      icon={Power}
                      accent="green"
                      title={bonus.is_active ? "Click to hide it from the page" : "Click to show it on the page"}
                    />
                    <RowToggle
                      on={bonus.featured}
                      busy={busy === `${bonus.id}:featured`}
                      onClick={() => patch(bonus, { featured: !bonus.featured }, "featured")}
                      onLabel="Featured"
                      offLabel="Feature"
                      icon={Star}
                      accent="amber"
                      title={bonus.featured ? "Click to stop featuring it" : "Pin it to the top of the page"}
                    />
                    <button
                      type="button"
                      onClick={() => setEditing(bonus.id)}
                      title="Edit"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-white/35 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(bonus)}
                      disabled={busy === `${bonus.id}:delete`}
                      title={confirmDelete === bonus.id ? "Click again to delete" : "Delete"}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-white/35 transition hover:bg-white/[0.05] hover:text-[#E5484D]"
                      style={confirmDelete === bonus.id ? { color: ACCENTS.red, backgroundColor: `${ACCENTS.red}1a` } : undefined}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <AnimatePresence initial={false}>
                        {confirmDelete === bonus.id && (
                          <motion.span
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "auto", opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="overflow-hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.1em]"
                          >
                            Confirm
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>

      <BonusEditor
        open={editing !== null}
        initial={editingBonus ? draftFrom(editingBonus) : EMPTY}
        isNew={editing === "new"}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </div>
  )
}

function RowToggle({
  on,
  busy,
  onClick,
  onLabel,
  offLabel,
  icon: Icon,
  accent,
  title,
}: {
  on: boolean
  busy: boolean
  onClick: () => void
  onLabel: string
  offLabel: string
  icon: typeof Power
  accent: keyof typeof ACCENTS
  title?: string
}) {
  const color = ACCENTS[accent]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      className="inline-flex h-8 min-w-[96px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors duration-200 disabled:opacity-50"
      style={
        on
          ? { color, borderColor: `${color}66`, backgroundColor: `${color}1f` }
          : { color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.10)" }
      }
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {on ? onLabel : offLabel}
    </button>
  )
}

/**
 * Create or edit one offer, with the card as it will appear beside the form.
 *
 * Portalled to <body>: the admin page wrapper animates on navigation, and a
 * dialog inside it would move with it.
 */
function BonusEditor({
  open,
  initial,
  isNew,
  onClose,
  onSave,
}: {
  open: boolean
  initial: Draft
  isNew: boolean
  onClose: () => void
  onSave: (draft: Draft) => Promise<string | null>
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Start from the offer being opened (or a blank one) every time the dialog
  // opens. Not keyed on it: a remount on close would skip the exit animation.
  useEffect(() => {
    if (!open) return
    setDraft(initial)
    setProblem(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on opening
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const failed = await onSave(draft)
    setSaving(false)
    setProblem(failed)
  }

  // What the preview shows: the draft as the public page would receive it.
  const preview: Bonus = {
    id: "preview",
    ...rowFrom(draft),
    title: draft.title.trim() || "Bonus title",
    // An unsafe or half-typed link is not rendered as a button in the preview.
    casino_url: webUrlProblem(draft.casino_url, "") ? null : draft.casino_url.trim() || null,
    image_url: webUrlProblem(draft.image_url, "") ? null : draft.image_url.trim() || null,
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="bonus-editor"
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
            className="w-full max-w-4xl overflow-hidden rounded-lg border border-white/[0.10] bg-[#0E0E12] shadow-2xl shadow-black/60"
          >
            <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isNew ? ACCENTS.green : ACCENTS.blue }} />
              <MonoLabel className="text-white/70">{isNew ? "New bonus" : "Edit bonus"}</MonoLabel>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto rounded p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title" required>
                  <input
                    value={draft.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="Welcome bonus"
                    autoFocus
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Casino">
                  <input
                    value={draft.casino_name}
                    onChange={(e) => set("casino_name", e.target.value)}
                    placeholder="Stake"
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Value">
                  <input
                    value={draft.value}
                    onChange={(e) => set("value", e.target.value)}
                    placeholder="100% up to $500"
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Code">
                  <input
                    value={draft.code}
                    onChange={(e) => set("code", e.target.value)}
                    placeholder="TRINIDO"
                    className={`${FIELD_CLASS} font-mono`}
                  />
                </Field>
                <Field label="Claim link" wide>
                  <input
                    value={draft.casino_url}
                    onChange={(e) => set("casino_url", e.target.value)}
                    placeholder="https://…"
                    inputMode="url"
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Image link" wide>
                  <input
                    value={draft.image_url}
                    onChange={(e) => set("image_url", e.target.value)}
                    placeholder="https://… (optional)"
                    inputMode="url"
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Description" wide>
                  <textarea
                    value={draft.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                    placeholder="What the offer is, in a sentence or two."
                    className={`${FIELD_CLASS} h-auto resize-y py-2`}
                  />
                </Field>
                <Field label="Terms" wide>
                  <textarea
                    value={draft.terms}
                    onChange={(e) => set("terms", e.target.value)}
                    rows={2}
                    placeholder="40x wagering, 18+, new players only"
                    className={`${FIELD_CLASS} h-auto resize-y py-2`}
                  />
                </Field>

                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <RowToggle
                    on={draft.is_active}
                    busy={false}
                    onClick={() => set("is_active", !draft.is_active)}
                    onLabel="Live"
                    offLabel="Hidden"
                    icon={Power}
                    accent="green"
                  />
                  <RowToggle
                    on={draft.featured}
                    busy={false}
                    onClick={() => set("featured", !draft.featured)}
                    onLabel="Featured"
                    offLabel="Feature"
                    icon={Star}
                    accent="amber"
                  />
                </div>
              </div>

              <div>
                <MonoLabel className="mb-1.5 block text-white/30">Preview</MonoLabel>
                <div className="pointer-events-none">
                  <BonusCard bonus={preview} />
                </div>
                {!draft.is_active && (
                  <p className="mt-2 text-[11.5px] text-white/35">Hidden: this card will not show on the page.</p>
                )}
              </div>
            </div>

            <footer className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-3">
              <AnimatePresence>
                {problem && (
                  <motion.p
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[12.5px]"
                    style={{ color: ACCENTS.red }}
                  >
                    {problem}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-md border border-white/[0.10] px-4 text-[13px] text-white/60 transition hover:border-white/25 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !draft.title.trim()}
                  className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
                  style={{ backgroundColor: isNew ? ACCENTS.green : ACCENTS.blue }}
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isNew ? "Create bonus" : "Save changes"}
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

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <MonoLabel className="mb-1.5 block text-white/40">
        {label}
        {required && <span style={{ color: ACCENTS.amber }}> *</span>}
      </MonoLabel>
      {children}
    </label>
  )
}
