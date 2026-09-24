"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Eraser, RefreshCw } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"
import { FIELD_CLASS } from "@/components/ui/select-menu"
import { createClient } from "@/lib/supabase/client"
import { cleanMaxWin, formatMoney, readMoney, readMultiplier, type NowPlayingRow } from "@/lib/now-playing"

/**
 * What the /obs/now-playing bar is showing.
 *
 * The usual way to set this is the extension's "Set as now playing" button on
 * the casino page, which fills every field from the game you already have open.
 * This page is the manual path: a game the extension cannot see, a correction,
 * or taking the bar down.
 *
 * Anything typed here is remembered against the slot, so the next time that
 * game comes up — from here or from the extension — it arrives complete. That
 * is the fix for the multiplier and the badge going missing on a slot switch:
 * they only have to be right once.
 *
 * Best win is the exception to "typed wins": left empty, it is the biggest
 * payout that slot has ever had across your hunts, which keeps itself current.
 * Typing a figure pins it until you clear it again.
 *
 * Typing one higher than the figure the bar was showing is a record, and puts
 * "NEW RECORD!" in the stream column — the same card the opening page triggers
 * when a bonus beats the slot's best. The multiplier field only feeds that card.
 */

type Draft = {
  slotName: string
  provider: string
  maxWin: string
  badge: string
  imageUrl: string
  bestWin: string
  recordMultiplier: string
}

const emptyDraft: Draft = {
  slotName: "",
  provider: "",
  maxWin: "",
  badge: "",
  imageUrl: "",
  bestWin: "",
  recordMultiplier: "",
}

function draftFromRow(row: NowPlayingRow | null): Draft {
  if (!row) return emptyDraft
  return {
    slotName: row.slot_name ?? "",
    provider: row.provider ?? "",
    maxWin: row.max_win ?? "",
    badge: row.badge ?? "",
    imageUrl: row.image_url ?? "",
    // Blank means "work it out from the hunts", which is the normal case, so
    // the resolved figure is shown as a placeholder rather than filled in.
    bestWin: "",
    recordMultiplier: "",
  }
}

type Suggestion = { game_name: string; provider: string }

export default function NowPlayingAdmin() {
  const [row, setRow] = useState<NowPlayingRow | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [recordSent, setRecordSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/now-playing", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Could not load.")
      setRow(payload.row as NowPlayingRow | null)
      setDraft(draftFromRow(payload.row as NowPlayingRow | null))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Follows the row while the page is open, so pressing the button on the
   * casino page — or auto-update firing by itself — shows up here without a
   * Reload click.
   *
   * Deliberately updates only the "on the overlay" card, never the draft: the
   * form is what you are typing, and having it overwritten under the cursor
   * because the extension pushed a game would be worse than it being stale.
   *
   * Read straight from the table rather than through the admin route. It has a
   * public SELECT policy, so this needs no service role, and it is the same
   * subscription the overlay itself uses.
   */
  useEffect(() => {
    const supabase = createClient()

    const pull = async () => {
      const { data } = await supabase.from("now_playing").select("*").eq("id", 1).maybeSingle()
      if (data) setRow(data as NowPlayingRow)
    }

    const channel = supabase
      .channel("now_playing_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "now_playing" }, (payload) => {
        setRow(payload.new as NowPlayingRow)
      })
      .subscribe()

    // Realtime can miss a beat, and the whole point of this card is to be
    // trustworthy about what the audience is seeing.
    const poll = setInterval(pull, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [])

  // Suggestions come straight from the browser — the slots table is public and
  // holds nothing but names, so there is no reason to route it through a
  // server handler.
  useEffect(() => {
    const term = draft.slotName.trim()
    if (term.length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("slots")
        .select("game_name, provider")
        .ilike("game_name", `%${term}%`)
        .limit(6)
      if (!cancelled) setSuggestions((data ?? []) as Suggestion[])
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft.slotName])

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    setRecordSent(false)
    try {
      const response = await fetch("/api/admin/now-playing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_name: draft.slotName,
          provider: draft.provider,
          max_win: draft.maxWin,
          badge: draft.badge,
          image_url: draft.imageUrl,
          best_win: draft.bestWin,
          record_multiplier: draft.recordMultiplier,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Could not save.")
      setRow(payload.row as NowPlayingRow)
      setDraft(draftFromRow(payload.row as NowPlayingRow))
      setSuggestions([])
      setSaved(true)
      setRecordSent(payload.record === true)
      setTimeout(() => {
        setSaved(false)
        setRecordSent(false)
      }, 4000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/now-playing", { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Could not clear.")
      setRow(payload.row as NowPlayingRow)
      setDraft(emptyDraft)
      setSuggestions([])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear.")
    } finally {
      setBusy(false)
    }
  }

  const obsUrl =
    typeof window === "undefined" ? "/obs/now-playing" : `${window.location.origin}/obs/now-playing`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(obsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not reach the clipboard — copy the URL by hand.")
    }
  }

  const onAir = !!row?.slot_name
  const normalisedMaxWin = cleanMaxWin(draft.maxWin)

  return (
    <div className="space-y-4 pb-10">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Now playing</h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 py-1.5 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </header>

      <Panel accent={onAir ? "green" : "slate"}>
        <PanelHeader
          title="On the overlay"
          accent={onAir ? "green" : "slate"}
          right={
            onAir ? (
              <button
                type="button"
                onClick={() => void clear()}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 py-1 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : undefined
          }
        />
        <div className="p-4">
          {onAir ? (
            <div className="flex flex-wrap items-center gap-3">
              {row?.badge && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: `${ACCENTS.green}22`, color: ACCENTS.green }}
                >
                  {row.badge}
                </span>
              )}
              <span className="text-[16px] font-semibold text-white">{row?.slot_name}</span>
              {row?.provider && <span className="text-[13px] text-white/45">{row.provider}</span>}
              {row?.max_win && (
                <span className="text-[13px]" style={{ color: ACCENTS.amber }}>
                  Potential {row.max_win}
                </span>
              )}
              {formatMoney(row?.best_win) && (
                <span className="text-[13px]" style={{ color: ACCENTS.green }}>
                  Best Win {formatMoney(row?.best_win)}
                </span>
              )}
              <span className="ml-auto text-[11px] text-white/30">
                set from the {row?.source === "extension" ? "extension" : "admin panel"} · follows changes
                live
              </span>
            </div>
          ) : (
            <p className="text-[13px] text-white/40">
              Nothing playing — the bar is not drawn at all, so the OBS source can stay on the scene.
            </p>
          )}
        </div>
      </Panel>

      <Panel accent="blue">
        <PanelHeader title="Set it by hand" />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="relative">
            <MonoLabel className="mb-2 block text-white/40">Slot</MonoLabel>
            <input
              value={draft.slotName}
              onChange={(event) => setDraft({ ...draft, slotName: event.target.value })}
              placeholder="Thunder vs Underworld 250"
              className={FIELD_CLASS}
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-white/[0.10] bg-[#0E1016] shadow-xl">
                {suggestions.map((suggestion) => (
                  <li key={`${suggestion.game_name}|${suggestion.provider}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, slotName: suggestion.game_name, provider: suggestion.provider })
                        setSuggestions([])
                      }}
                      className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] text-white/80 transition hover:bg-white/[0.06]"
                    >
                      <span>{suggestion.game_name}</span>
                      <span className="text-[11px] text-white/35">{suggestion.provider}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <MonoLabel className="mb-2 block text-white/40">Provider</MonoLabel>
            <input
              value={draft.provider}
              onChange={(event) => setDraft({ ...draft, provider: event.target.value })}
              placeholder="Pragmatic Play"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <MonoLabel className="mb-2 block text-white/40">Potential</MonoLabel>
            <input
              value={draft.maxWin}
              onChange={(event) => setDraft({ ...draft, maxWin: event.target.value })}
              placeholder="25,000x"
              className={FIELD_CLASS}
            />
            <p className="mt-2 text-[11px] text-white/30">
              {normalisedMaxWin ? `Shows as ${normalisedMaxWin}` : "Left out of the bar when empty."}
            </p>
          </div>

          <div>
            <MonoLabel className="mb-2 block text-white/40">Badge</MonoLabel>
            <input
              value={draft.badge}
              onChange={(event) => setDraft({ ...draft, badge: event.target.value })}
              placeholder="Only on Stake"
              className={FIELD_CLASS}
            />
          </div>

          <div className="md:col-span-2">
            <MonoLabel className="mb-2 block text-white/40">Best win</MonoLabel>
            <div className="flex flex-wrap gap-2">
              <input
                value={draft.bestWin}
                onChange={(event) => setDraft({ ...draft, bestWin: event.target.value })}
                placeholder={formatMoney(row?.best_win) ?? "worked out from your hunts"}
                className={`${FIELD_CLASS} max-w-[280px]`}
              />
              <input
                value={draft.recordMultiplier}
                onChange={(event) => setDraft({ ...draft, recordMultiplier: event.target.value })}
                placeholder="Multiplier, e.g. 172x"
                aria-label="Record multiplier"
                className={`${FIELD_CLASS} max-w-[180px]`}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/30">
              {readMoney(draft.bestWin)
                ? `Pinned to ${formatMoney(readMoney(draft.bestWin))} for this slot, until you clear it.`
                : "Leave empty and it takes the biggest payout this slot has ever had across your hunts. Typing a figure pins it."}
            </p>
            {(() => {
              // Mirrors the route's rule, so the admin knows before saving.
              const typed = readMoney(draft.bestWin)
              const current = row?.best_win ?? null
              const sameSlot = row?.slot_name?.trim().toLowerCase() === draft.slotName.trim().toLowerCase()
              if (!typed || !sameSlot || !current || typed <= current) return null
              const multiplier = readMultiplier(draft.recordMultiplier)
              return (
                <p className="mt-1 text-[11px]" style={{ color: ACCENTS.amber }}>
                  Beats {formatMoney(current)} — saving puts NEW RECORD! on stream
                  {multiplier ? ` with ${multiplier.toLocaleString("en-US")}x` : ", without a multiplier unless you add one"}.
                </p>
              )
            })()}
          </div>

          <div className="md:col-span-2">
            <MonoLabel className="mb-2 block text-white/40">Artwork URL (optional)</MonoLabel>
            <input
              value={draft.imageUrl}
              onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
              placeholder="https://…"
              className={FIELD_CLASS}
            />
            <p className="mt-2 text-[11px] text-white/30">
              http(s) only, and dropped if longer than 500 characters. The extension fills this from the
              game&apos;s own thumbnail.
            </p>
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || loading || !draft.slotName.trim()}
          className="rounded-md px-4 py-2 text-[13px] font-medium text-black transition disabled:opacity-40"
          style={{ backgroundColor: ACCENTS.blue }}
        >
          {busy ? "Saving…" : "Put it on the overlay"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px]" style={{ color: ACCENTS.green }}>
            <Check className="h-3.5 w-3.5" />
            Live — the overlay updates itself.
          </span>
        )}
        {recordSent && (
          <span className="text-[12px] font-medium" style={{ color: ACCENTS.amber }}>
            NEW RECORD! sent to the stream column.
          </span>
        )}
        {error && (
          <span className="text-[12px]" style={{ color: ACCENTS.red }}>
            {error}
          </span>
        )}
      </div>

      <Panel>
        <PanelHeader title="OBS source" accent="slate" />
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-white/[0.10] bg-black/40 px-3 py-1.5 text-[12px] text-white/70">
              {obsUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 py-1.5 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-white/[0.10] bg-black/40 px-3 py-1.5 text-[12px] text-white/70">
              {obsUrl.replace("/now-playing", "/casino-top")}
            </code>
            <span className="text-[11px] text-white/30">the matching strip above the capture</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code
              className="rounded-md border px-3 py-1.5 text-[12px]"
              style={{ borderColor: `${ACCENTS.green}55`, backgroundColor: "rgba(0,0,0,0.4)", color: "#DDE7EC" }}
            >
              {obsUrl.replace("/now-playing", "/casino-frame")}
            </code>
            <span className="text-[11px] text-white/45">
              both strips and the side rails as one 1410×900 frame — set the source to that size
            </span>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/30">
            Both take <code className="text-white/45">?x ?y ?w ?h</code> to place the strip inside the source,
            or <code className="text-white/45">?align=top|middle|bottom</code>. Set the source to the size it
            occupies on the canvas and never resize the box — a source rendered at half the width and
            stretched is what makes an overlay look soft.{" "}
            <code className="text-white/45">?preview=1</code> shows a sample without touching what is saved,
            and <code className="text-white/45">?art=1</code> adds the thumbnail.
          </p>
        </div>
      </Panel>
    </div>
  )
}
