/**
 * Scoring the "guess the balance" round.
 *
 * Three independent categories, each with its own winner — being closest on the
 * balance says nothing about whether you also called the best game. Kept as
 * plain functions so the ranking can be checked without a database.
 */

export type Prediction = {
  id: string
  username: string
  predicted_max_multiplier: number
  predicted_best_game: string
  predicted_end_balance: number
  created_at: string
}

export type Actuals = {
  highestMulti: number | null
  finalBalance: number | null
  bestGame: string | null
}

export type CategoryId = "multiplier" | "game" | "balance"

export type Ranked = {
  prediction: Prediction
  /** What they guessed, already formatted for the column. */
  guess: string
  /** Distance from the truth. 0 is exact; null for an unscored category. */
  delta: number | null
  place: number
}

export const CATEGORIES: { id: CategoryId; label: string; accent: "amber" | "blue" | "green" }[] = [
  { id: "multiplier", label: "Highest multiplier", accent: "amber" },
  { id: "game", label: "Best game", accent: "blue" },
  { id: "balance", label: "Final balance", accent: "green" },
]

/** Loose match so "Le Bandit " and "le bandit" count as the same call. */
function sameGame(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * The leaderboard for one category, closest first.
 *
 * Returns an empty list while the category has no result yet: showing a
 * provisional "winner" against a balance that has not been reached would be
 * worse than showing nothing, because it is the kind of thing that gets read
 * out on stream.
 *
 * Ties are broken by submission time — whoever called it first. Guessing the
 * same number later is not the same achievement.
 */
export function rankCategory(predictions: Prediction[], actuals: Actuals, category: CategoryId, limit = 3): Ranked[] {
  const rows: { prediction: Prediction; guess: string; delta: number }[] = []

  for (const prediction of predictions) {
    if (category === "multiplier") {
      if (actuals.highestMulti === null) return []
      const value = Number(prediction.predicted_max_multiplier)
      if (!Number.isFinite(value)) continue
      rows.push({ prediction, guess: `${value.toFixed(2)}x`, delta: Math.abs(value - actuals.highestMulti) })
    } else if (category === "balance") {
      if (actuals.finalBalance === null) return []
      const value = Number(prediction.predicted_end_balance)
      if (!Number.isFinite(value)) continue
      rows.push({
        prediction,
        guess: `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
        delta: Math.abs(value - actuals.finalBalance),
      })
    } else {
      if (!actuals.bestGame) return []
      // An exact call or nothing — "close" is meaningless for a game name, so
      // wrong answers are dropped rather than ranked by string distance.
      if (!sameGame(prediction.predicted_best_game, actuals.bestGame)) continue
      rows.push({ prediction, guess: prediction.predicted_best_game, delta: 0 })
    }
  }

  rows.sort((a, b) => {
    if (a.delta !== b.delta) return a.delta - b.delta
    const first = Date.parse(a.prediction.created_at)
    const second = Date.parse(b.prediction.created_at)
    if (Number.isFinite(first) && Number.isFinite(second) && first !== second) return first - second
    return a.prediction.username.localeCompare(b.prediction.username)
  })

  return rows.slice(0, limit).map((row, index) => ({ ...row, place: index + 1 }))
}

/** All three categories at once, in the order they are shown. */
export function rankAll(predictions: Prediction[], actuals: Actuals, limit = 3) {
  return CATEGORIES.map((category) => ({
    ...category,
    winners: rankCategory(predictions, actuals, category.id, limit),
    /** The truth this category was scored against, or null while unresolved. */
    actual:
      category.id === "multiplier"
        ? actuals.highestMulti === null
          ? null
          : `${actuals.highestMulti.toFixed(2)}x`
        : category.id === "balance"
          ? actuals.finalBalance === null
            ? null
            : `$${actuals.finalBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
          : actuals.bestGame,
  }))
}
