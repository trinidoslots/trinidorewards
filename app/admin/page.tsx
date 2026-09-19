"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Crosshair, Gift, Settings, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile } from "@/components/ui/panel"
import { formatMoney, formatTransactionTime, totalsFor, type Transaction } from "@/lib/transactions"

const SHORTCUTS = [
  { href: "/admin/bonushunt", icon: Crosshair, label: "Bonus hunt", copy: "Run the current hunt and its opening." },
  { href: "/admin/giveaway", icon: Gift, label: "Giveaway", copy: "Open entries, roll a winner." },
  { href: "/admin/users", icon: Users, label: "Users", copy: "Points, roles, site usernames." },
  { href: "/admin/settings", icon: Settings, label: "Settings", copy: "Transactions and the given-away total." },
]

const OBS_SOURCES = [
  { path: "/obs/hunt", label: "Bonus hunt", size: "400×800" },
  { path: "/obs/stream", label: "Stream column", size: "340×900" },
  { path: "/obs/giveaway", label: "Giveaway only", size: "300×120" },
  { path: "/deposits-withdrawals", label: "Transactions", size: "340×140" },
  { path: "/obs/top-bar", label: "Top ticker", size: "1920×50" },
  { path: "/obs/complete", label: "Everything, one source", size: "1920×1080" },
]

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [givenAway, setGivenAway] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const load = async () => {
      const supabase = supabaseRef.current
      const [ledger, settings] = await Promise.all([
        supabase
          .from("transaction_events")
          .select("id, kind, amount, created_at, note")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("settings").select("value").eq("key", "total_given_away").maybeSingle(),
      ])

      if (ledger.error) console.error("[v0] Error loading ledger:", ledger.error)
      else setTransactions((ledger.data ?? []) as Transaction[])

      const parsed = Number.parseInt(settings.data?.value ?? "", 10)
      if (Number.isFinite(parsed)) setGivenAway(parsed)

      setLoading(false)
    }
    load()
  }, [])

  const totals = useMemo(() => totalsFor(transactions), [transactions])
  const recent = transactions.slice(0, 6)
  const dash = "—"

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="mt-1 text-[13px] text-white/40">Where the numbers stand and what to open next.</p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Deposited" accent="red" value={loading ? dash : formatMoney(totals.deposited)} />
        <StatTile label="Cashed out" accent="green" value={loading ? dash : formatMoney(totals.cashedOut)} />
        <StatTile
          label="Net"
          accent={totals.net > 0 ? "green" : totals.net < 0 ? "red" : undefined}
          value={loading ? dash : totals.net === 0 ? "–" : `${totals.net > 0 ? "+" : "−"}${formatMoney(totals.net)}`}
        />
        <StatTile
          label="Given away"
          accent="purple"
          value={givenAway === null ? dash : `$${givenAway.toLocaleString()}`}
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader
            title="Recent transactions"
            accent="green"
            right={
              <Link href="/admin/settings" className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/35 transition hover:text-white/80">
                Manage
              </Link>
            }
          />

          {loading ? (
            <p className="py-8 text-center font-mono text-[11px] uppercase tracking-widest text-white/25">Loading</p>
          ) : recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-white/30">
              Nothing yet. Add a deposit or cashout in Settings.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recent.map((transaction) => {
                const isDeposit = transaction.kind === "deposit"
                const color = isDeposit ? ACCENTS.red : ACCENTS.green
                return (
                  <li key={transaction.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                      style={{ color, backgroundColor: `${color}1a` }}
                    >
                      {isDeposit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </span>
                    <span className="w-24 shrink-0 text-[13px] font-semibold tabular-nums" style={{ color }}>
                      {isDeposit ? "−" : "+"}
                      {formatMoney(Number(transaction.amount))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-white/40">{transaction.note ?? ""}</span>
                    <time className="shrink-0 font-mono text-[10px] tabular-nums text-white/25">
                      {formatTransactionTime(transaction.created_at)}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="OBS sources" accent="amber" />
          <ul className="divide-y divide-white/[0.06]">
            {OBS_SOURCES.map((source) => (
              <ObsSourceRow key={source.path} {...source} />
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map(({ href, icon: Icon, label, copy }) => (
          <Link key={href} href={href} className="group block">
            <Panel className="h-full p-3.5 transition hover:border-white/20 hover:bg-white/[0.05]">
              <Icon className="h-4 w-4 text-white/35 transition group-hover:text-white/70" />
              <p className="mt-2.5 text-[13px] font-semibold text-white">{label}</p>
              <p className="mt-1 text-[11.5px] leading-5 text-white/35">{copy}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Copies the absolute URL, because OBS needs the full address, not the path. */
function ObsSourceRow({ path, label, size }: { path: string; label: string; size: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; the path is on screen either way.
    }
  }

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] text-white/80">{label}</p>
        <p className="truncate font-mono text-[10px] text-white/25">{path}</p>
      </div>
      <MonoLabel className="shrink-0 text-white/25">{size}</MonoLabel>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} URL`}
        className="shrink-0 rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white/80"
      >
        {copied ? <Check className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </li>
  )
}
