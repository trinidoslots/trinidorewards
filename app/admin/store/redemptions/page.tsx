"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, Panel, StatTile } from "@/components/ui/panel"
import type { PayoutDetails } from "@/lib/payout"
import { points, RedemptionsList, type Redemption, type Wallet } from "@/components/admin/redemptions-list"

/**
 * What people have bought, and whether it has been handed over.
 *
 * Fetching and the status writes; the list itself is in RedemptionsList.
 *
 * The user is joined in a second query rather than through a foreign-key
 * select: redemptions has no relationship declared to users in PostgREST, so
 * an embedded select fails on some projects and silently returns nulls on
 * others.
 */

type UserRow = { id: string; username: string }

export default function StoreRedemptionsPage() {
  const supabaseRef = useRef(createClient())

  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [users, setUsers] = useState<Map<string, string>>(new Map())
  const [payouts, setPayouts] = useState<Record<string, PayoutDetails>>({})
  /** Wallets each buyer has saved, keyed by user id. See the API route. */
  const [wallets, setWallets] = useState<Record<string, Wallet[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
      if (response.ok) {
        setPayouts(payload.payouts ?? {})
        setWallets(payload.wallets ?? {})
      }
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

  const setStatusOf = useCallback(async (ids: string[], next: string) => {
    if (ids.length === 0) return

    const { error: problem } = await supabaseRef.current.from("redemptions").update({ status: next }).in("id", ids)
    if (problem) {
      setError(problem.message || "Could not update those redemptions")
      return
    }

    const changed = new Set(ids)
    setRedemptions((current) => current.map((entry) => (changed.has(entry.id) ? { ...entry, status: next } : entry)))
    setSelected(new Set())
    setError(null)
  }, [])

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

      <RedemptionsList
        rows={rows}
        total={redemptions.length}
        users={users}
        payouts={payouts}
        wallets={wallets}
        loading={loading}
        query={query}
        onQuery={setQuery}
        status={status}
        onStatus={setStatus}
        selected={selected}
        onSelected={setSelected}
        expanded={expanded}
        onExpanded={setExpanded}
        onSetStatus={setStatusOf}
      />
    </div>
  )
}
