"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Check, Clock, Package, RefreshCw, Search, Undo2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"
import { CopyableId, CopyButton } from "@/components/ui/copyable-id"
import { describePayout, type PayoutDetails } from "@/lib/payout"
import { SelectMenu } from "@/components/ui/select-menu"

/**
 * What people have bought, and whether it has been handed over.
 *
 * The user is joined in a second query rather than through a foreign-key
 * select: redemptions has no relationship declared to users in PostgREST, so
 * an embedded select fails on some projects and silently returns nulls on
 * others.
 */

type Redemption = {
  id: string
  user_id: string
  item_id: string
  item_name: string
  cost: number
  status: string
  created_at: string
}

type UserRow = { id: string; username: string }

const STATUSES = [
  { id: "pending", label: "Pending", accent: "amber" as const },
  { id: "completed", label: "Completed", accent: "green" as const },
  { id: "cancelled", label: "Cancelled", accent: "red" as const },
]

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

function statusMeta(status: string) {
  return STATUSES.find((entry) => entry.id === status) ?? { id: status, label: status, accent: "slate" as const }
}

export default function StoreRedemptionsPage() {
  const supabaseRef = useRef(createClient())

  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [users, setUsers] = useState<Map<string, string>>(new Map())
  const [payouts, setPayouts] = useState<Record<string, PayoutDetails>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = supabaseRef.current

    const { data, error: problem } = await supabase
      .from("redemptions")
      .select("id, user_id, item_id, item_name, cost, status, created_at")
      .order("created_at", { ascending: false })

    if (problem) {
      console.error("[v0] Error fetching redemptions:", problem)
      setError(problem.message || "Could not load redemptions")
      setLoading(false)
      return
    }

    const rows = (data ?? []) as Redemption[]
    setRedemptions(rows)
    setError(null)

    const ids = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)))
    if (ids.length > 0) {
      const { data: people } = await supabase.from("users").select("id, username").in("id", ids)
      setUsers(new Map(((people ?? []) as UserRow[]).map((person) => [person.id, person.username])))
    }

    // Through the API rather than the browser client: redemption_payouts has
    // RLS on and no policy precisely so a wallet address is not readable with
    // the anon key. A failure here must not take the list down with it.
    try {
      const response = await fetch("/api/admin/redemptions/payouts", { cache: "no-store" })
      const payload = await response.json()
      if (response.ok) setPayouts(payload.payouts ?? {})
    } catch (problem) {
      console.error("[v0] Could not load payout details:", problem)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return redemptions.filter((row) => {
      if (status !== "all" && row.status !== status) return false
      if (!needle) return true
      const username = users.get(row.user_id) ?? ""
      return row.item_name.toLowerCase().includes(needle) || username.toLowerCase().includes(needle)
    })
  }, [redemptions, query, status, users])

  const totals = useMemo(
    () => ({
      all: redemptions.length,
      pending: redemptions.filter((row) => row.status === "pending").length,
      spent: redemptions
        .filter((row) => row.status !== "cancelled")
        .reduce((sum, row) => sum + (Number(row.cost) || 0), 0),
    }),
    [redemptions],
  )

  async function setStatusOf(row: Redemption, next: string) {
    const { error: problem } = await supabaseRef.current.from("redemptions").update({ status: next }).eq("id", row.id)
    if (problem) {
      setError(problem.message || "Could not update that redemption")
      return
    }
    setRedemptions((current) => current.map((entry) => (entry.id === row.id ? { ...entry, status: next } : entry)))
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Redemptions</h1>
          <p className="mt-1 text-[13px] text-white/40">What people bought, and what still needs handing over.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/store"
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            Store
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Redemptions" value={totals.all.toLocaleString()} />
        <StatTile label="Waiting on you" value={totals.pending.toLocaleString()} accent="amber" />
        <StatTile label="Points spent" value={points(totals.spent)} accent="green" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search item or user…"
              className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </div>
          <div className="w-44">
            <SelectMenu
              aria-label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "Any status" }, ...STATUSES.map((e) => ({ value: e.id, label: e.label }))]}
            />
          </div>
          <MonoLabel className="text-white/25">{rows.length}</MonoLabel>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Package className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">
              {redemptions.length === 0 ? "Nothing redeemed yet." : "Nothing matches those filters."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {rows.map((row) => {
              const meta = statusMeta(row.status)
              const username = users.get(row.user_id)
              const done = row.status === "completed"
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                  {row.status === "pending" ? (
                    <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.amber }} />
                  ) : done ? (
                    <Check className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.green }} />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.red }} />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white">{row.item_name}</p>
                    <div className="flex items-center gap-2">
                      {username ? (
                        <>
                          <Link
                            href={`/admin/users/${row.user_id}`}
                            className="truncate text-[11px] text-white/40 underline-offset-4 hover:text-white hover:underline"
                          >
                            {username}
                          </Link>
                          {/* Paying someone out means pasting their exact name
                              somewhere else; picking it out of the row by hand
                              is one mistyped character away from the wrong
                              person. */}
                          <CopyButton value={username} label="username" />
                        </>
                      ) : (
                        <CopyableId value={row.user_id} chars={4} />
                      )}
                    </div>

                    {/* What actually has to be done to fulfil it. The address is
                        shown in full rather than truncated — an admin about to
                        send money needs to see the whole thing. */}
                    {payouts[row.id] && (
                      <p className="mt-0.5 flex items-start gap-1 text-[11px] text-white/45">
                        <span className="break-all" style={{ color: ACCENTS.purple }}>
                          {describePayout(payouts[row.id])}
                        </span>
                        {payouts[row.id].method === "crypto" ? (
                          <>
                            <span className="break-all font-mono text-[10px] text-white/35">
                              {(payouts[row.id] as { address: string }).address}
                            </span>
                            <CopyButton
                              value={(payouts[row.id] as { address: string }).address}
                              label="wallet address"
                            />
                          </>
                        ) : (
                          <CopyButton
                            value={(payouts[row.id] as { username: string }).username}
                            label="payout username"
                          />
                        )}
                      </p>
                    )}
                  </div>

                  <Tag accent={meta.accent}>{meta.label}</Tag>

                  <span className="w-20 shrink-0 text-right text-[13px] tabular-nums" style={{ color: ACCENTS.blue }}>
                    {points(row.cost)}
                  </span>

                  <MonoLabel className="w-36 shrink-0 text-right text-white/20">{when(row.created_at)}</MonoLabel>

                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatusOf(row, done ? "pending" : "completed")}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition"
                      style={
                        done
                          ? { borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }
                          : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.4)" }
                      }
                    >
                      {done ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      {done ? "Done" : "Complete"}
                    </button>
                    {row.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => setStatusOf(row, "cancelled")}
                        aria-label={`Cancel ${row.item_name}`}
                        className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
