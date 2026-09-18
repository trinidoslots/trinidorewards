/**
 * Wagered and earned, and which of the two a board is run on.
 *
 * A wager race ranks on volume — how much went through the account. A profit
 * race ranks on what the player actually took home. Both numbers live on every
 * entry; ranking_metric says which one decides the order and which one is the
 * headline figure on the page.
 */

export type Metric = "wagered" | "earned"

export const METRICS: { id: Metric; label: string; column: "total_wagered" | "total_earned"; hint: string }[] = [
  {
    id: "wagered",
    label: "Wagered",
    column: "total_wagered",
    hint: "Ranks on volume — how much went through the account.",
  },
  {
    id: "earned",
    label: "Earned",
    column: "total_earned",
    hint: "Ranks on what the player took home.",
  },
]

export function isMetric(value: unknown): value is Metric {
  return value === "wagered" || value === "earned"
}

/** Anything unrecognised means the long-standing default. */
export function readMetric(value: unknown): Metric {
  return isMetric(value) ? value : "wagered"
}

export function metricLabel(metric: Metric): string {
  return metric === "earned" ? "Earned" : "Wagered"
}

export function otherMetric(metric: Metric): Metric {
  return metric === "earned" ? "wagered" : "earned"
}

/**
 * One entry as the rest of the app wants it, whatever shape the row arrived in.
 *
 * The column is being renamed from wager_amount to total_wagered, and the SQL
 * and the deploy do not land at the same moment. Reading both means neither
 * order breaks the page: before the migration the old name answers, after it
 * the new one does.
 */
export function entryAmounts(row: Record<string, unknown>): { total_wagered: number; total_earned: number } {
  const wagered = row.total_wagered ?? row.wager_amount ?? 0
  const earned = row.total_earned ?? 0
  return {
    total_wagered: Number(wagered) || 0,
    total_earned: Number(earned) || 0,
  }
}

/** What this entry is ranked by. */
export function amountFor(
  entry: { total_wagered: number; total_earned: number },
  metric: Metric,
): number {
  return metric === "earned" ? entry.total_earned : entry.total_wagered
}
