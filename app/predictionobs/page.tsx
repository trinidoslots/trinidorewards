"use client"

import { useEffect, useMemo, useState } from "react"
import { ImageIcon, Trophy } from "lucide-react"

type Category = "ending_balance" | "highest_multi" | "highest_win"

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "ending_balance", label: "Ending Balance" },
  { key: "highest_multi", label: "Highest Multi" },
  { key: "highest_win", label: "Best Game" },
]

type Resolved = {
  actual_highest_multi: number | null
  actual_final_balance: number | null
  actual_best_game: string | null
  actual_best_game_image: string | null
}

export default function PredictionObsWidget() {
  const [resolved, setResolved] = useState<Resolved>({
    actual_highest_multi: null,
    actual_final_balance: null,
    actual_best_game: null,
    actual_best_game_image: null,
  })
  const [predictions, setPredictions] = useState<any[]>([])
  const [categoryIndex, setCategoryIndex] = useState(0)

  useEffect(() => {
    let disposed = false

    const fetchTargets = async () => {
      try {
        const response = await fetch("/api/admin/predictions", { cache: "no-store" })
        if (!response.ok) return
        const payload = await response.json()
        if (disposed) return
        setResolved({
          actual_highest_multi: payload.hunt?.best_multiplier ?? null,
          actual_final_balance: payload.hunt?.total_won == null ? null : Number(payload.hunt.total_won),
          actual_best_game: payload.hunt?.best_cash_win_game ?? null,
          actual_best_game_image: payload.hunt?.best_cash_win_image ?? null,
        })
        setPredictions(Array.isArray(payload.predictions) ? payload.predictions : [])
      } catch (error) {
        console.error("[v0] Error fetching prediction targets:", error)
      }
    }

    fetchTargets()
    const dataTimer = setInterval(fetchTargets, 5_000)
    return () => {
      disposed = true
      clearInterval(dataTimer)
    }
  }, [])

  useEffect(() => {
    const cycleTimer = setInterval(() => {
      setCategoryIndex((index) => (index + 1) % CATEGORIES.length)
    }, 10_000)
    return () => clearInterval(cycleTimer)
  }, [])

  const category = CATEGORIES[categoryIndex]
  const actual =
    category.key === "ending_balance"
      ? resolved.actual_final_balance
      : category.key === "highest_multi"
        ? resolved.actual_highest_multi
        : resolved.actual_best_game

  const targetDisplay =
    actual == null
      ? "Awaiting result"
      : category.key === "ending_balance"
        ? `$${Number(actual).toFixed(2)}`
        : category.key === "highest_multi"
          ? `${Number(actual).toFixed(2)}x`
          : actual

  const isBestGame = category.key === "highest_win"

  const leaders = useMemo(() => {
    if (category.key === "ending_balance") {
      return [...predictions]
        .filter((p) => p.predicted_end_balance != null)
        .sort((a, b) =>
          resolved.actual_final_balance == null
            ? b.predicted_end_balance - a.predicted_end_balance
            : Math.abs(a.predicted_end_balance - resolved.actual_final_balance) -
              Math.abs(b.predicted_end_balance - resolved.actual_final_balance),
        )
        .slice(0, 3)
    }
    if (category.key === "highest_multi") {
      return [...predictions]
        .filter((p) => p.predicted_max_multiplier != null)
        .sort((a, b) =>
          resolved.actual_highest_multi == null
            ? b.predicted_max_multiplier - a.predicted_max_multiplier
            : Math.abs(a.predicted_max_multiplier - resolved.actual_highest_multi) -
              Math.abs(b.predicted_max_multiplier - resolved.actual_highest_multi),
        )
        .slice(0, 3)
    }
    const list = [...predictions].filter((p) => p.predicted_best_game)
    if (resolved.actual_best_game) {
      list.sort(
        (a, b) =>
          (String(a.predicted_best_game).toLowerCase() === resolved.actual_best_game!.toLowerCase() ? 0 : 1) -
          (String(b.predicted_best_game).toLowerCase() === resolved.actual_best_game!.toLowerCase() ? 0 : 1),
      )
    }
    return list.slice(0, 3)
  }, [category.key, predictions, resolved])

  const leaderMatches = (prediction: any, index: number) =>
    category.key === "highest_win"
      ? !!resolved.actual_best_game &&
        String(prediction.predicted_best_game).toLowerCase() === resolved.actual_best_game.toLowerCase()
      : index === 0 && actual != null

  const leaderValue = (prediction: any) =>
    category.key === "ending_balance"
      ? `$${Number(prediction.predicted_end_balance).toFixed(2)}`
      : category.key === "highest_multi"
        ? `${Number(prediction.predicted_max_multiplier).toFixed(2)}x`
        : prediction.predicted_best_game

  const noBestGameWinner =
    category.key === "highest_win" &&
    resolved.actual_best_game != null &&
    !predictions.some(
      (prediction) => String(prediction.predicted_best_game).toLowerCase() === resolved.actual_best_game!.toLowerCase(),
    )

  return (
    <div className="min-h-screen bg-transparent p-4">
      <div className="w-[320px] overflow-hidden rounded-xl border border-[#4D84FF]/30 bg-gradient-to-b from-[#1A1F2B]/95 to-[#0B0E13]/95 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-[#4D84FF]/30 bg-gradient-to-r from-[#4D84FF]/20 to-[#7FB3FF]/20 px-5 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-[#7FB3FF]" />
            <h1 className="text-xl font-bold text-white">PREDICTIONS</h1>
          </div>
          <span className="text-xs italic text-gray-400">{new Date().toLocaleDateString("en-GB")}</span>
        </div>

        <div key={category.key} className="prediction-category-transition flex h-[130px] flex-col items-center justify-center px-5 py-5">
          <p className="text-center text-xs font-bold uppercase tracking-[0.24em] text-[#7FB3FF]">
            {category.label}
          </p>
          {isBestGame && actual != null ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="relative aspect-[180/236] w-12 shrink-0 overflow-hidden rounded-lg border border-[#4D84FF]/30 bg-[#0B0E13]">
                {resolved.actual_best_game_image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                  <img
                    src={resolved.actual_best_game_image || "/placeholder.svg"}
                    alt={String(actual)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-[#4D84FF]/60" />
                )}
              </span>
              <p className="text-balance text-left text-lg font-bold leading-tight text-white">{targetDisplay}</p>
            </div>
          ) : (
            <p className="mt-3 text-balance text-center text-2xl font-bold leading-tight text-white">
              {targetDisplay}
            </p>
          )}
        </div>

        <div key={`leaders-${category.key}`} className="prediction-leaderboard-transition space-y-1.5 border-t border-[#4D84FF]/20 px-4 py-3">
          {noBestGameWinner ? (
            <p className="py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
              No winner this round
            </p>
          ) : (
            [0, 1, 2].map((index) => {
              const prediction = leaders[index]
              if (!prediction) {
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2.5 rounded-lg border border-dashed border-[#4D84FF]/15 px-3 py-2"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#4D84FF]/10 text-[10px] font-bold text-gray-600">
                      {index + 1}
                    </span>
                    <div className="h-3 flex-1" />
                  </div>
                )
              }
              const matched = leaderMatches(prediction, index)
              return (
                <div
                  key={prediction.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                    matched ? "border-[#7FB3FF]/40 bg-[#4D84FF]/[0.12]" : "border-[#4D84FF]/15 bg-white/[0.02]"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#4D84FF]/15 text-[10px] font-bold text-[#7FB3FF]">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{prediction.username}</p>
                  <p className="shrink-0 text-xs font-bold text-[#7FB3FF]">{leaderValue(prediction)}</p>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-[#4D84FF]/20 py-3">
          {CATEGORIES.map((item, index) => (
            <span
              key={item.key}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === categoryIndex ? "w-6 bg-[#7FB3FF]" : "w-1.5 bg-[#4D84FF]/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
