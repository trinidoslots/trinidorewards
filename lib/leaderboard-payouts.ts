import type { Metric } from "@/lib/leaderboard-metric"

// The payout ladder — the single source of truth for what each rank wins.
//
// This used to live twice: the admin computed prizes on CSV upload and wrote
// them to leaderboard_entries.prize_amount, while the public page recomputed
// them from a different hard-coded ladder and ignored the stored value. Rank 8
// paid 1% in the admin and 4% on the site. Both sides now call prizeFor().

export type PayoutPreset = {
  id: string
  label: string
  /** One-line description of the shape, shown next to the choice in the admin. */
  description: string
  /**
   * Share of the pool per rank, index 0 = first place. Ranks past the end of
   * the array win nothing.
   */
  shares: number[]
}

/** Spreads `total` evenly across `count` places. */
function even(total: number, count: number): number[] {
  return Array.from({ length: count }, () => total / count)
}

export const PAYOUT_PRESETS: PayoutPreset[] = [
  {
    id: "winner-takes-most",
    label: "Winner takes most",
    description: "3 places. Very top-heavy — first place takes 70%.",
    shares: [0.7, 0.2, 0.1],
  },
  {
    id: "podium",
    label: "Podium",
    description: "3 places, a gentler drop than winner-takes-most.",
    shares: [0.5, 0.3, 0.2],
  },
  {
    id: "classic",
    label: "Classic",
    description: "10 places. Top-heavy, the long-standing default.",
    shares: [0.4, 0.25, 0.15, 0.1, 0.05, ...even(0.05, 5)],
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "15 places. Rewards the chase without gutting the top.",
    shares: [0.25, 0.2, 0.15, 0.12, 0.1, ...even(0.1, 5), ...even(0.08, 5)],
  },
  {
    id: "wide",
    label: "Wide",
    description: "25 places. Flatter, keeps mid-table players in it.",
    shares: [0.15, 0.12, 0.1, 0.08, 0.07, ...even(0.15, 5), ...even(0.12, 5), ...even(0.21, 10)],
  },
  {
    id: "very-wide",
    label: "Very wide",
    description: "50 places. For big communities where reach matters more than a headline prize.",
    shares: [0.1, 0.08, 0.07, 0.06, 0.05, ...even(0.16, 5), ...even(0.14, 10), ...even(0.34, 30)],
  },
  {
    id: "top-five-flat",
    label: "Top five, flat",
    description: "5 places, every one paid the same. Simple to explain on stream.",
    shares: even(1, 5),
  },
  {
    id: "top-ten-flat",
    label: "Top ten, flat",
    description: "10 places, every one paid the same.",
    shares: even(1, 10),
  },
]

export const DEFAULT_PRESET_ID = "classic"

const BY_ID = new Map(PAYOUT_PRESETS.map((preset) => [preset.id, preset]))

// The old prize_distribution_type values, so leaderboards created before the
// catalogue existed keep paying what they paid.
const LEGACY_ALIASES: Record<string, string> = {
  classic: "classic",
  balanced: "balanced",
  wide: "wide",
}

export function getPreset(id: string | null | undefined): PayoutPreset {
  if (!id) return BY_ID.get(DEFAULT_PRESET_ID)!
  return BY_ID.get(id) ?? BY_ID.get(LEGACY_ALIASES[id] ?? DEFAULT_PRESET_ID) ?? BY_ID.get(DEFAULT_PRESET_ID)!
}

/** What rank `rank` (1-based) wins out of `prizePool`. */
export function prizeFor(rank: number, prizePool: number, presetId: string | null | undefined): number {
  const share = getPreset(presetId).shares[rank - 1]
  if (!share || !Number.isFinite(prizePool)) return 0
  return Math.round(prizePool * share)
}

/** How many places a preset pays. */
export function paidPlaces(presetId: string | null | undefined): number {
  return getPreset(presetId).shares.length
}

/**
 * Ranks entries by the board's own metric (highest first) and attaches the
 * prize each one wins.
 *
 * Which metric that is comes from the board, not from here: a wager race
 * sorts on total_wagered, a profit race on total_earned. Ties keep their
 * incoming order, which for a CSV import is the order the casino exported.
 */
export function rankEntries<T extends { total_wagered: number | string; total_earned?: number | string }>(
  entries: T[],
  prizePool: number,
  presetId: string | null | undefined,
  metric: Metric = 'wagered',
): (T & { rank: number; prize_amount: number })[] {
  const amount = (entry: T) =>
    Number(metric === 'earned' ? (entry.total_earned ?? 0) : entry.total_wagered) || 0

  return [...entries]
    .sort((a, b) => amount(b) - amount(a))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      prize_amount: prizeFor(index + 1, prizePool, presetId),
    }))
}

/**
 * Rounding means a preset rarely pays out the pool to the cent. Surfaced in the
 * admin so a mismatch is visible before a leaderboard goes live rather than
 * after someone adds the prizes up.
 */
export function payoutSummary(prizePool: number, presetId: string | null | undefined) {
  const preset = getPreset(presetId)
  const paid = preset.shares.reduce((sum, _share, index) => sum + prizeFor(index + 1, prizePool, presetId), 0)
  return { preset, places: preset.shares.length, paid, remainder: prizePool - paid }
}
