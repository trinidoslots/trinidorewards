"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Loader2, Trash2, Wallet } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  formatMoney,
  formatTransactionTime,
  totalsFor,
  type Transaction,
  type TransactionKind,
} from "@/lib/transactions"

/**
 * The deposit / cashout ledger: add a movement, see the history, correct a
 * mistake. Totals are computed from the rows, never stored, so deleting a
 * mistyped entry puts every figure back where it belongs.
 */
export function TransactionsPanel() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [kind, setKind] = useState<TransactionKind>("deposit")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabaseRef.current
      .from("transaction_events")
      .select("id, kind, amount, created_at, note")
      .order("created_at", { ascending: false })
      .limit(200)

    if (loadError) {
      setError("Could not load transactions.")
      console.error("[v0] Error loading transactions:", loadError)
    } else {
      setError(null)
      setTransactions((data ?? []) as Transaction[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => totalsFor(transactions), [transactions])

  async function addTransaction(event: React.FormEvent) {
    event.preventDefault()
    const parsed = Number.parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter an amount greater than zero.")
      return
    }

    setSaving(true)
    const { error: insertError } = await supabaseRef.current
      .from("transaction_events")
      .insert([{ kind, amount: parsed, note: note.trim() || null }])

    if (insertError) {
      setError("Could not save the transaction.")
      console.error("[v0] Error adding transaction:", insertError)
    } else {
      setAmount("")
      setNote("")
      await load()
    }
    setSaving(false)
  }

  async function removeTransaction(id: string) {
    const previous = transactions
    setTransactions((current) => current.filter((transaction) => transaction.id !== id))

    const { error: deleteError } = await supabaseRef.current.from("transaction_events").delete().eq("id", id)
    if (deleteError) {
      console.error("[v0] Error deleting transaction:", deleteError)
      setError("Could not delete that transaction.")
      setTransactions(previous) // put it back rather than lie about the state
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur">
      <header className="flex items-center gap-2 border-b border-slate-700/50 px-4 py-3">
        <Wallet className="h-4 w-4 text-[#7FB3FF]" />
        <h2 className="text-sm font-semibold text-white">Transactions</h2>
        <span className="ml-auto text-[11px] text-slate-400">
          {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
        </span>
      </header>

      <div className="grid grid-cols-3 gap-px border-b border-slate-700/50 bg-slate-700/50">
        <Total label="Deposited" value={formatMoney(totals.deposited)} tone="text-red-400" />
        <Total label="Cashed out" value={formatMoney(totals.cashedOut)} tone="text-emerald-400" />
        <Total
          label="Net"
          value={totals.net === 0 ? "-" : `${totals.net > 0 ? "+" : "-"}${formatMoney(totals.net)}`}
          tone={totals.net === 0 ? "text-white" : totals.net > 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      <form onSubmit={addTransaction} className="flex flex-wrap items-end gap-2 border-b border-slate-700/50 p-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-700">
          {(["deposit", "cashout"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`px-3 py-2 text-xs font-semibold transition ${
                kind === option
                  ? option === "deposit"
                    ? "bg-red-500/20 text-red-300"
                    : "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {option === "deposit" ? "Deposit" : "Cashout"}
            </button>
          ))}
        </div>

        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount"
          className="h-9 w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder:text-slate-500"
        />

        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          className="h-9 min-w-40 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder:text-slate-500"
        />

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#4D84FF] px-4 text-xs font-bold text-white transition hover:bg-[#3D6FE0] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Add
        </button>
      </form>

      {error && <p className="border-b border-slate-700/50 px-4 py-2 text-[11px] text-red-300">{error}</p>}

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            No transactions yet. Add one above and it shows up on the stream widget.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {transactions.map((transaction) => {
              const isDeposit = transaction.kind === "deposit"
              return (
                <li key={transaction.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isDeposit ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
                    }`}
                  >
                    {isDeposit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>

                  <span className={`w-24 shrink-0 text-sm font-bold ${isDeposit ? "text-red-400" : "text-emerald-400"}`}>
                    {isDeposit ? "-" : "+"}
                    {formatMoney(Number(transaction.amount))}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{transaction.note ?? ""}</span>

                  <time className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {formatTransactionTime(transaction.created_at)}
                  </time>

                  <button
                    type="button"
                    onClick={() => removeTransaction(transaction.id)}
                    aria-label="Delete transaction"
                    className="shrink-0 rounded-md p-1.5 text-slate-600 opacity-0 transition hover:bg-red-500/15 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function Total({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-slate-900/60 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}
