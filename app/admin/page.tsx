"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Crosshair,
  Gift,
  Settings,
  Tv,
  Users,
  Wallet,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatMoney, formatTransactionTime, totalsFor, type Transaction } from "@/lib/transactions"

const ACCENT = "#4D84FF"
const ACCENT_SOFT = "#7FB3FF"

const SHORTCUTS = [
  { href: "/admin/bonushunt", icon: Crosshair, label: "Bonus hunt", copy: "Run the current hunt and its opening." },
  { href: "/admin/giveaway", icon: Gift, label: "Giveaway", copy: "Open entries, roll a winner." },
  { href: "/admin/users", icon: Users, label: "Users", copy: "Points, roles, site usernames." },
  { href: "/admin/settings", icon: Settings, label: "Settings", copy: "Transactions, Kick credentials." },
]

const OBS_SOURCES = [
  { path: "/obs/bonushunt", label: "Bonus hunt", size: "400 x 800" },
  { path: "/obs/stream", label: "Stream column", size: "340 x 900" },
  { path: "/obs/giveaway", label: "Giveaway only", size: "300 x 120" },
  { path: "/deposits-withdrawals", label: "Transactions", size: "340 x 140" },
  { path: "/obs-widget", label: "Top ticker", size: "1920 x 50" },
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">Where the numbers stand and what to open next.</p>
      </header>

      {/* --------------------------------------------------------------- KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Deposited" value={loading ? "—" : formatMoney(totals.deposited)} tone="text-red-400" />
        <Kpi label="Cashed out" value={loading ? "—" : formatMoney(totals.cashedOut)} tone="text-emerald-400" />
        <Kpi
          label="Net"
          value={loading ? "—" : totals.net === 0 ? "-" : `${totals.net > 0 ? "+" : "-"}${formatMoney(totals.net)}`}
          tone={totals.net === 0 ? "text-white" : totals.net > 0 ? "text-emerald-400" : "text-red-400"}
        />
        <Kpi
          label="Given away"
          value={givenAway === null ? "—" : `$${givenAway.toLocaleString()}`}
          tone="text-white"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------------ Recent movements */}
        <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60">
          <header className="flex items-center gap-2 border-b border-slate-700/50 px-4 py-3">
            <Wallet className="h-4 w-4" style={{ color: ACCENT_SOFT }} />
            <h2 className="text-sm font-semibold text-white">Recent transactions</h2>
            <Link
              href="/admin/settings"
              className="ml-auto text-[11px] font-semibold transition hover:underline"
              style={{ color: ACCENT_SOFT }}
            >
              Manage
            </Link>
          </header>

          {loading ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">
              Nothing yet. Add a deposit or cashout in Settings.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {recent.map((transaction) => {
                const isDeposit = transaction.kind === "deposit"
                return (
                  <li key={transaction.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isDeposit ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {isDeposit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <span
                      className={`w-24 shrink-0 text-sm font-bold tabular-nums ${
                        isDeposit ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {isDeposit ? "-" : "+"}
                      {formatMoney(Number(transaction.amount))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{transaction.note ?? ""}</span>
                    <time className="shrink-0 text-[11px] tabular-nums text-slate-500">
                      {formatTransactionTime(transaction.created_at)}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* --------------------------------------------------- OBS source list */}
        <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60">
          <header className="flex items-center gap-2 border-b border-slate-700/50 px-4 py-3">
            <Tv className="h-4 w-4" style={{ color: ACCENT_SOFT }} />
            <h2 className="text-sm font-semibold text-white">OBS sources</h2>
          </header>
          <ul className="divide-y divide-slate-800">
            {OBS_SOURCES.map((source) => (
              <ObsSourceRow key={source.path} {...source} />
            ))}
          </ul>
        </section>
      </div>

      {/* ---------------------------------------------------------- Shortcuts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map(({ href, icon: Icon, label, copy }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 transition hover:border-slate-600 hover:bg-slate-900"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg border"
              style={{ borderColor: `${ACCENT}33`, backgroundColor: `${ACCENT}14`, color: ACCENT_SOFT }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-white">{label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
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
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">{label}</p>
        <p className="truncate font-mono text-[11px] text-slate-500">{path}</p>
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{size}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} URL`}
        className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </li>
  )
}
