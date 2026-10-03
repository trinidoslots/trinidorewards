"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileJson,
  Gamepad2,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { ONLY_ON_STAKE_BADGE, STAKE_EXCLUSIVES_SCRIPT, STAKE_EXPORT_SCRIPT, type Slot } from "@/lib/slots"
import { BADGE_GRADIENT, BADGE_TEXT } from "@/lib/now-playing"
import { formatProvider } from "@/lib/providers"
import { SlotSyncPanel } from "@/components/admin/slot-sync-panel"

/**
 * The slot catalogue: what the hunt form, the tournament form and the random
 * slot pick from.
 *
 * Filled mainly by importing Stake's whole slot list (see lib/slots.ts for why
 * that goes through the admin's browser), topped up by hand for anything the
 * import does not have. Searched on the server, a page at a time — the
 * catalogue is several thousand rows and loading it whole is what made the old
 * page slow.
 */

const PAGE_SIZE = 50

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

type Counts = { total: number | null; withArt: number | null; fromStake: number | null; exclusive: number | null }

/** The "Only on Stake" chip, in the colours the now-playing bar uses for it. */
function OnlyOnStake() {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ backgroundImage: BADGE_GRADIENT, color: BADGE_TEXT }}
    >
      {ONLY_ON_STAKE_BADGE}
    </span>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold"
        style={{ backgroundColor: `${ACCENTS.blue}22`, color: ACCENTS.blue }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-white">{title}</p>
        <div className="mt-1 text-[12.5px] leading-relaxed text-white/45">{children}</div>
      </div>
    </li>
  )
}

export default function SlotsPage() {
  const [supabase] = useState(() => createClient())
  const [rows, setRows] = useState<Slot[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const [counts, setCounts] = useState<Counts>({ total: null, withArt: null, fromStake: null, exclusive: null })
  const [query, setQuery] = useState("")
  const [exclusiveOnly, setExclusiveOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [copied, setCopied] = useState<"all" | "exclusive" | null>(null)
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [tidying, setTidying] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState({ game_name: "", provider: "", image_url: "" })
  const [adding, setAdding] = useState(false)

  const loadCounts = useCallback(async () => {
    const head = { count: "exact" as const, head: true }
    const [total, withArt, fromStake, exclusive] = await Promise.all([
      supabase.from("slots").select("id", head),
      supabase.from("slots").select("id", head).not("image_url", "is", null),
      supabase.from("slots").select("id", head).eq("source", "stake"),
      supabase.from("slots").select("id", head).eq("only_on_stake", true),
    ])
    // These need scripts/077 and 078; before that they fail and read as "—".
    setCounts({
      total: total.error ? null : total.count ?? 0,
      withArt: withArt.error ? null : withArt.count ?? 0,
      fromStake: fromStake.error ? null : fromStake.count ?? 0,
      exclusive: exclusive.error ? null : exclusive.count ?? 0,
    })
  }, [supabase])

  const loadPage = useCallback(async () => {
    setLoading(true)
    const needle = query.trim()
    let request = supabase.from("slots").select("*", { count: "exact" })
    if (needle) {
      const pattern = `"%${needle.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/"/g, '\\"')}%"`
      request = request.or(`game_name.ilike.${pattern},provider.ilike.${pattern}`)
    }
    if (exclusiveOnly) request = request.eq("only_on_stake", true)
    const { data, count, error: problem } = await request
      .order("game_name")
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (problem) {
      console.error("[slots] Could not load:", problem)
      setError("The catalogue could not be loaded.")
    } else {
      setRows((data ?? []) as Slot[])
      setMatchCount(count ?? 0)
      setError(null)
    }
    setLoading(false)
  }, [supabase, query, page, exclusiveOnly])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  // A short pause after typing before searching.
  useEffect(() => {
    const timer = setTimeout(loadPage, query ? 200 : 0)
    return () => clearTimeout(timer)
  }, [loadPage, query])

  function copyScript(which: "all" | "exclusive") {
    navigator.clipboard.writeText(which === "all" ? STAKE_EXPORT_SCRIPT : STAKE_EXCLUSIVES_SCRIPT).then(() => {
      setCopied(which)
      setTimeout(() => setCopied((current) => (current === which ? null : current)), 2000)
    })
  }

  async function importFile(file: File) {
    setImporting(true)
    setImportNotice(null)
    try {
      const text = await file.text()
      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        throw new Error("That file is not JSON – upload the stake-slots.json the script downloaded.")
      }
      const res = await fetch("/api/admin/slots/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "The import failed.")
      setImportNotice({
        ok: true,
        text:
          json.kind === "only-on-stake"
            ? `Tagged ${Number(json.written).toLocaleString()} slots as Only on Stake${json.untagged ? `; ${json.untagged} are no longer exclusive and lost the tag` : ""}.`
            : `Imported ${Number(json.written).toLocaleString()} slots from Stake${json.skipped ? ` (${json.skipped} entries skipped)` : ""}.`,
      })
      setPage(0)
      loadCounts()
      loadPage()
    } catch (problem) {
      setImportNotice({ ok: false, text: problem instanceof Error ? problem.message : "The import failed." })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  /** One-off: providers the first import stored as slugs ("donut-gaming") become names. */
  async function tidyProviders() {
    setTidying(true)
    setImportNotice(null)
    const res = await fetch("/api/admin/slots/tidy-providers", { method: "POST" })
    const json = await res.json().catch(() => ({}))
    setTidying(false)
    if (!res.ok) {
      setImportNotice({ ok: false, text: json.error ?? "Could not tidy the provider names." })
      return
    }
    setImportNotice({
      ok: true,
      text: json.providers
        ? `Tidied ${json.providers} provider names across ${Number(json.renamed).toLocaleString()} slots${json.merged ? ` (${json.merged} duplicates merged)` : ""}.`
        : "Every provider name is already tidy.",
    })
    loadCounts()
    loadPage()
  }

  async function addSlot(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.game_name.trim() || !draft.provider.trim()) return
    setAdding(true)
    const image = draft.image_url.trim()
    const { error: problem } = await supabase.from("slots").insert({
      game_name: draft.game_name.trim(),
      provider: draft.provider.trim(),
      // Only sent when given, so adding works before scripts/077 as well.
      ...(image ? { image_url: image } : {}),
    })
    setAdding(false)
    if (problem) {
      setError(problem.code === "23505" ? "That slot is already in the catalogue." : problem.message || "Could not add the slot.")
      return
    }
    setDraft({ game_name: "", provider: "", image_url: "" })
    setError(null)
    loadCounts()
    loadPage()
  }

  async function removeSlot(slot: Slot) {
    if (!confirm(`Remove ${slot.game_name} from the catalogue?`)) return
    const { error: problem } = await supabase.from("slots").delete().eq("id", slot.id)
    if (problem) {
      setError(problem.message || "Could not remove the slot.")
      return
    }
    setRows((current) => current.filter((entry) => entry.id !== slot.id))
    setMatchCount((current) => Math.max(0, current - 1))
    loadCounts()
  }

  const pages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE))
  const shown = (value: number | null) => (value === null ? "—" : value.toLocaleString())

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">Slots</h1>
        <p className="mt-1 text-[13px] text-white/40">
          The catalogue the hunt form, tournaments and the random slot pick from.
        </p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Slots in the catalogue" value={shown(counts.total)} accent="blue" />
        <StatTile label="With artwork" value={shown(counts.withArt)} accent="green" />
        <StatTile label="Imported from Stake" value={shown(counts.fromStake)} accent="amber" />
        <StatTile label="Only on Stake" value={shown(counts.exclusive)} accent="purple" />
      </div>

      <SlotSyncPanel
        onSynced={() => {
          loadCounts()
          loadPage()
        }}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel accent="amber">
          <PanelHeader title="Import every slot from Stake" accent="amber" />
          <ol className="space-y-4 p-4">
            <Step n={1} title="Open Stake in this browser">
              Go to{" "}
              <a
                href="https://stake.com/casino/group/slots"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-white"
              >
                stake.com <ExternalLink className="h-3 w-3" />
              </a>{" "}
              the way you normally do (with your VPN, if you use one). Stake blocks requests from servers, so the list is
              read from your own tab.
            </Step>
            <Step n={2} title="Run the export script">
              Copy the script, press <kbd className="rounded border border-white/15 px-1 font-mono text-[11px]">F12</kbd>,
              open <b className="text-white/70">Console</b>, paste it and press Enter. It reads the slot list page by
              page and downloads <span className="font-mono text-white/70">stake-slots.json</span>. If Chrome asks you
              to type &quot;allow pasting&quot; first, do that.
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyScript("all")}
                  className="flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white transition hover:bg-white/[0.08]"
                >
                  {copied === "all" ? <Check className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "all" ? "Copied" : "Copy: all slots"}
                </button>
                <button
                  type="button"
                  onClick={() => copyScript("exclusive")}
                  className="flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white transition hover:bg-white/[0.08]"
                >
                  {copied === "exclusive" ? (
                    <Check className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === "exclusive" ? "Copied" : "Copy: Only on Stake"}
                </button>
              </div>
              <p className="mt-2">
                <b className="text-white/70">All slots</b> fills the catalogue (stake-slots.json).{" "}
                <b className="text-white/70">Only on Stake</b> reads{" "}
                <a
                  href="https://stake.com/casino/group/only-on-stake"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-white"
                >
                  that group
                </a>{" "}
                and tags those slots (stake-only-on-stake.json) – the tag also fills the badge on the now-playing bar.
              </p>
            </Step>
            <Step n={3} title="Upload the file here">
              Either file goes in the same button – it knows which is which. New releases come with the next import;
              slots already here are updated, never doubled.
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void importFile(file)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: ACCENTS.amber }}
                >
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {importing ? "Importing…" : "Upload a Stake file"}
                </button>
                <button
                  type="button"
                  onClick={tidyProviders}
                  disabled={tidying || importing}
                  title='Rewrites providers Stake sent as slugs, e.g. "donut-gaming" → "Donut Gaming"'
                  className="flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {tidying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {tidying ? "Tidying…" : "Tidy provider names"}
                </button>
              </div>
              {importNotice && (
                <p className="mt-2 text-[12.5px]" style={{ color: importNotice.ok ? ACCENTS.green : ACCENTS.red }}>
                  {importNotice.text}
                </p>
              )}
            </Step>
          </ol>
        </Panel>

        <Panel accent="blue">
          <PanelHeader title="Add a slot by hand" />
          <form onSubmit={addSlot} className="space-y-3 p-4">
            <label className="block">
              <MonoLabel className="mb-1.5 block text-white/35">Name</MonoLabel>
              <input
                value={draft.game_name}
                onChange={(e) => setDraft({ ...draft, game_name: e.target.value })}
                placeholder="e.g. Gates of Olympus"
                className={field}
                required
              />
            </label>
            <label className="block">
              <MonoLabel className="mb-1.5 block text-white/35">Provider</MonoLabel>
              <input
                value={draft.provider}
                onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
                placeholder="e.g. Pragmatic Play"
                className={field}
                required
              />
            </label>
            <label className="block">
              <MonoLabel className="mb-1.5 block text-white/35">Artwork URL</MonoLabel>
              <input
                value={draft.image_url}
                onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                placeholder="Optional"
                className={field}
              />
            </label>
            <button
              type="submit"
              disabled={adding || !draft.game_name.trim() || !draft.provider.trim()}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.blue }}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add slot
            </button>
          </form>
        </Panel>
      </div>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(0)
              }}
              placeholder="Search name or provider…"
              className={`${field} pl-9`}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setExclusiveOnly((current) => !current)
              setPage(0)
            }}
            aria-pressed={exclusiveOnly}
            className="flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] transition"
            style={
              exclusiveOnly
                ? { borderColor: `${ACCENTS.purple}77`, backgroundColor: `${ACCENTS.purple}1a`, color: "#fff" }
                : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }
            }
          >
            Only on Stake
          </button>
          <MonoLabel className="text-white/25">{matchCount.toLocaleString()} slots</MonoLabel>
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            {query ? <Search className="h-7 w-7 text-white/10" /> : <FileJson className="h-7 w-7 text-white/10" />}
            <p className="text-[13px] text-white/30">
              {query || exclusiveOnly
                ? exclusiveOnly && !query
                  ? "No slot is tagged Only on Stake yet – run the Only on Stake script above."
                  : "Nothing matches that search."
                : "The catalogue is empty – import it from Stake above."}
            </p>
          </div>
        ) : (
          <ul className={`divide-y divide-white/[0.05] transition-opacity ${loading ? "opacity-50" : ""}`}>
            {rows.map((slot) => (
              <li key={slot.id} className="flex items-center gap-3 px-3.5 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]">
                  {slot.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external slot artwork
                    <img src={slot.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Gamepad2 className="h-4 w-4 text-white/15" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white">{slot.game_name}</p>
                  <p className="truncate text-[11px] text-white/30">{formatProvider(slot.provider)}</p>
                </div>
                {slot.only_on_stake && <OnlyOnStake />}
                {slot.source === "stake" ? <Tag accent="amber">Stake</Tag> : <Tag accent="slate">Manual</Tag>}
                <button
                  type="button"
                  onClick={() => removeSlot(slot)}
                  title="Remove"
                  className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.08] px-3.5 py-2.5">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/50 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <MonoLabel className="text-white/30">
              Page {page + 1} of {pages}
            </MonoLabel>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
              disabled={page >= pages - 1}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/50 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-30"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Panel>
    </div>
  )
}
