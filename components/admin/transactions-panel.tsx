"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Loader2, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"
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

  const netColor = totals.net === 0 ? "#E7E7EA" : totals.net > 0 ? ACCENTS.green : ACCENTS.red

  return (
    <Panel>
      <PanelHeader
        title="Transactions"
        accent="green"
        right={
          <MonoLabel className="text-white/30">
            {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
          </MonoLabel>
        }
      />

      <div className="grid grid-cols-3 divide-x divide-white/[0.08] border-b border-white/[0.08]">
        <Figure label="Deposited" value={formatMoney(totals.deposited)} color={ACCENTS.red} />
        <Figure label="Cashed out" value={formatMoney(totals.cashedOut)} color={ACCENTS.green} />
        <Figure
          label="Net"
          value={totals.net === 0 ? "–" : `${totals.net > 0 ? "+" : "−"}${formatMoney(totals.net)}`}
          color={netColor}
        />
      </div>

      <form onSubmit={addTransaction} className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
        <div className="flex overflow-hidden rounded-md border border-white/10">
          {(["deposit", "cashout"] as const).map((option) => {
            const active = kind === option
            const color = option === "deposit" ? ACCENTS.red : ACCENTS.green
            return (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition"
                style={
                  active
                    ? { color, backgroundColor: `${color}1f` }
                    : { color: "rgba(255,255,255,0.35)", backgroundColor: "transparent" }
                }
              >
                {option}
              </button>
            )
          })}
        </div>

        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount"
          className="h-9 w-32 rounded-md border border-white/10 bg-black/40 px-3 text-[13px] tabular-nums text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
        />

        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          className="h-9 min-w-40 flex-1 rounded-md border border-white/10 bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
        />

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Add
        </button>
      </form>

      {error && (
        <p className="border-b border-white/[0.08] px-3.5 py-2 text-[11px]" style={{ color: ACCENTS.red }}>
          {error}
        </p>
      )}

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <p className="py-8 text-center font-mono text-[11px] uppercase tracking-widest text-white/25">Loading</p>
        ) : transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-white/30">
            No transactions yet. Add one above and it shows up on the stream widget.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {transactions.map((transaction) => {
              const isDeposit = transaction.kind === "deposit"
              const color = isDeposit ? ACCENTS.red : ACCENTS.green
              return (
                <li key={transaction.id} className="group flex items-center gap-3 px-3.5 py-2.5">
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

                  <button
                    type="button"
                    onClick={() => removeTransaction(transaction.id)}
                    aria-label="Delete transaction"
                    className="shrink-0 rounded p-1.5 text-white/20 opacity-0 transition hover:text-white/70 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}

function Figure({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[22px] font-semibold leading-none tabular-nums tracking-tight" style={{ color }}>
        {value}
      </p>
      <MonoLabel className="mt-2 block text-white/35">{label}</MonoLabel>
    </div>
  )
}
