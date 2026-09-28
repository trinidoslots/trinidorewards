"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Dices, Loader2, Power, RefreshCw, Trash2, Tv } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import type { PromoCode } from "@/lib/promo-codes"
import { useAdminAccess } from "@/components/admin-access"

/**
 * Promo codes: make a code worth N points, switch it on or off, and put it in
 * the stream widget's event column (/obs/stream) for viewers to copy.
 *
 * Viewers redeem on /redeem, once per account. Everything here goes through
 * /api/admin/promo-codes; the table itself is not writable from the browser.
 */

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/30 px-2.5 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-white/25"

function Toggle({
  on,
  busy,
  onClick,
  onLabel,
  offLabel,
  icon: Icon,
  accent,
  disabled,
  title,
}: {
  on: boolean
  busy: boolean
  onClick: () => void
  onLabel: string
  offLabel: string
  icon: typeof Power
  accent: keyof typeof ACCENTS
  disabled?: boolean
  title?: string
}) {
  const color = ACCENTS[accent]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className="inline-flex h-8 min-w-[104px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
      style={
        on
          ? { color, borderColor: `${color}66`, backgroundColor: `${color}1f` }
          : { color: "rgba(255,255,255,0.55)", borderColor: "rgba(255,255,255,0.10)" }
      }
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {on ? onLabel : offLabel}
    </button>
  )
}

export default function PromoCodesPage() {
  // Moderators get this page read-only (lib/admin-permissions.ts).
  const { canEdit } = useAdminAccess()
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [code, setCode] = useState("")
  const [points, setPoints] = useState("")
  const [maxUses, setMaxUses] = useState("")
  const [codeUsersOnly, setCodeUsersOnly] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/promo-codes", { cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) setError(json.error ?? "Could not load the codes.")
    else {
      setCodes(json.codes ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    setCreating(true)
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim() || undefined,
        points: Number(points),
        max_uses: maxUses || null,
        code_user_only: codeUsersOnly,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok) {
      setFormError(json.error ?? "Could not create the code.")
      return
    }
    setCodes((current) => [json.code, ...current])
    setCode("")
    setMaxUses("")
  }

  async function patch(target: PromoCode, change: Partial<Pick<PromoCode, "is_active" | "show_on_stream">>, key: string) {
    setBusy(`${target.id}:${key}`)
    const res = await fetch("/api/admin/promo-codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: target.id, ...change }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) {
      setError(json.error ?? "Could not update the code.")
      return
    }
    setCodes((current) => current.map((entry) => (entry.id === target.id ? json.code : entry)))
  }

  async function remove(target: PromoCode) {
    if (!confirm(`Delete ${target.code}? Points already redeemed stay with the viewers.`)) return
    setBusy(`${target.id}:delete`)
    const res = await fetch(`/api/admin/promo-codes?id=${encodeURIComponent(target.id)}`, { method: "DELETE" })
    setBusy(null)
    if (res.ok) setCodes((current) => current.filter((entry) => entry.id !== target.id))
    else setError("Could not delete the code.")
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(value)
      setTimeout(() => setCopied((current) => (current === value ? null : current)), 1500)
    })
  }

  const active = codes.filter((entry) => entry.is_active).length
  const onStream = codes.filter((entry) => entry.is_active && entry.show_on_stream).length
  const redeemed = codes.reduce((sum, entry) => sum + (Number(entry.uses_count) || 0), 0)

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Promo codes</h1>
          <p className="text-[13px] text-white/40">
            Codes viewers redeem for points under Redeem Code in the account menu – once per account.
          </p>
        </div>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Active codes" value={active.toLocaleString("en-US")} accent="green" />
        <StatTile label="On stream" value={onStream.toLocaleString("en-US")} accent="purple" />
        <StatTile label="Times redeemed" value={redeemed.toLocaleString("en-US")} accent="amber" />
      </div>

      {canEdit && (
      <Panel accent="blue">
        <PanelHeader title="New code" />
        <form onSubmit={create} className="grid gap-3 p-3.5 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
          <label className="block">
            <MonoLabel className="text-white/40">Code</MonoLabel>
            <div className="mt-1.5 flex gap-1.5">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="Leave empty for a random one"
                maxLength={32}
                className={`${field} font-mono uppercase`}
              />
              <button
                type="button"
                onClick={() => setCode("")}
                title="Random code on save"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.10] text-white/50 hover:bg-white/[0.05] hover:text-white"
              >
                <Dices className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label className="block">
            <MonoLabel className="text-white/40">Points</MonoLabel>
            <input
              value={points}
              onChange={(e) => setPoints(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="e.g. 500"
              required
              className={`${field} mt-1.5`}
            />
          </label>
          <label className="block">
            <MonoLabel className="text-white/40">Max uses</MonoLabel>
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="Unlimited"
              className={`${field} mt-1.5`}
            />
          </label>
          <button
            type="submit"
            disabled={creating || !points}
            className="h-9 rounded-md px-4 text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
            style={{ backgroundColor: ACCENTS.green }}
          >
            {creating ? "Creating…" : "Create code"}
          </button>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-white/60 sm:col-span-4">
            <input
              type="checkbox"
              checked={codeUsersOnly}
              onChange={(e) => setCodeUsersOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#A78BFA]"
            />
            Code Users only <span className="text-white/30">– only accounts with the Code User rank can redeem it</span>
          </label>
          <p className="text-[12px] text-white/35 sm:col-span-4">
            New codes start <b className="text-white/55">disabled</b> – switch one to Active when it should work.
          </p>
          {formError && (
            <p className="text-[12.5px] sm:col-span-4" style={{ color: ACCENTS.red }}>
              {formError}
            </p>
          )}
        </form>
      </Panel>
      )}

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Codes" accent="slate" />
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : codes.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-white/30">No codes yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {codes.map((entry) => {
              const usedUp = entry.max_uses !== null && entry.uses_count >= entry.max_uses
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copy(entry.code)}
                        title="Copy"
                        className="flex items-center gap-1.5 font-mono text-[15px] font-semibold tracking-wide text-white hover:text-white/80"
                      >
                        {entry.code}
                        {copied === entry.code ? (
                          <Check className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-white/30" />
                        )}
                      </button>
                      {!entry.is_active ? (
                        <Tag accent="slate">Disabled</Tag>
                      ) : usedUp ? (
                        <Tag accent="amber">Used up</Tag>
                      ) : (
                        <Tag accent="green">Active</Tag>
                      )}
                      {entry.is_active && entry.show_on_stream && <Tag accent="purple">On stream</Tag>}
                      {entry.code_user_only && <Tag accent="pink">Code Users</Tag>}
                    </div>
                    <p className="mt-1 text-[12px] text-white/40">
                      <span style={{ color: ACCENTS.amber }}>{entry.points.toLocaleString("en-US")} points</span>
                      {" · "}
                      {entry.uses_count.toLocaleString("en-US")}
                      {entry.max_uses !== null ? ` / ${entry.max_uses.toLocaleString("en-US")}` : ""} redeemed
                      {" · "}
                      {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>

                  {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <Toggle
                      on={entry.is_active}
                      busy={busy === `${entry.id}:active`}
                      onClick={() => patch(entry, { is_active: !entry.is_active }, "active")}
                      onLabel="Active"
                      offLabel="Disabled"
                      icon={Power}
                      accent="green"
                      title={entry.is_active ? "Click to disable" : "Click to activate"}
                    />
                    <Toggle
                      on={entry.show_on_stream}
                      busy={busy === `${entry.id}:stream`}
                      onClick={() => patch(entry, { show_on_stream: !entry.show_on_stream }, "stream")}
                      onLabel="On stream"
                      offLabel="Show on stream"
                      icon={Tv}
                      accent="purple"
                      disabled={!entry.is_active && !entry.show_on_stream}
                      title={
                        !entry.is_active
                          ? "Activate the code first"
                          : entry.show_on_stream
                            ? "Click to take it off the OBS event feed"
                            : "Show it in the OBS event feed"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => remove(entry)}
                      disabled={busy === `${entry.id}:delete`}
                      title="Delete"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-white/30 transition hover:bg-white/[0.05] hover:text-[#E5484D]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
