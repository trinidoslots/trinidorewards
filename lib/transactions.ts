// The deposit / cashout ledger.
//
// transaction_events holds one row per movement (see scripts/039). Totals are
// derived from it rather than stored, so a correction to a single entry is
// reflected everywhere instead of leaving a total that no longer adds up.

export type TransactionKind = "deposit" | "cashout"

export type Transaction = {
  id: string
  kind: TransactionKind
  amount: number
  created_at: string
  note: string | null
}

export type TransactionTotals = {
  deposited: number
  cashedOut: number
  /** Cashed out minus deposited — positive means up on the session. */
  net: number
}

export function totalsFor(transactions: Pick<Transaction, "kind" | "amount">[]): TransactionTotals {
  let deposited = 0
  let cashedOut = 0
  for (const transaction of transactions) {
    // Postgres numerics arrive as strings through PostgREST often enough that
    // coercing here is cheaper than being wrong about it at every call site.
    const amount = Number(transaction.amount) || 0
    if (transaction.kind === "deposit") deposited += amount
    else cashedOut += amount
  }
  return { deposited, cashedOut, net: cashedOut - deposited }
}

export function formatMoney(amount: number) {
  return `$${Math.round(Math.abs(amount)).toLocaleString()}`
}

/** "16 Sep, 20:57" — short enough for a dense table, unambiguous across days. */
export function formatTransactionTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
