"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ImageIcon, Lock, Sparkles, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { SelectMenu } from "@/components/ui/select-menu"

interface Props { huntId: string; isLoggedIn: boolean; currentUsername?: string; predictionsEnabled: boolean; hunts?: any[]; startingBalance?: number }
type Category = "ending_balance" | "highest_multi" | "highest_win"

export function PredictionsLeaderboard({ huntId, isLoggedIn, currentUsername, predictionsEnabled, hunts = [], startingBalance = 0 }: Props) {
  const [category, setCategory] = useState<Category>("ending_balance")
  const [predictions, setPredictions] = useState<any[]>([])
  const [form, setForm] = useState({ highest_multi: "", best_game: "", final_balance: "" })
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resolved, setResolved] = useState({ actual_highest_multi: null as number | null, actual_final_balance: null as number | null, actual_best_game: null as string | null })
  const [window, setWindow] = useState<{ status: "open" | "closed"; opens_at: string | null; closes_at: string | null }>({ status: "closed", opens_at: null, closes_at: null })
  const [clock, setClock] = useState(() => Date.now())
  const supabase = createClient()
  const categories: { key: Category; label: string; short: string }[] = [{ key: "ending_balance", label: "Final balance", short: "ENDING BALANCE" }, { key: "highest_multi", label: "Peak multiplier", short: "HIGHEST MULTI" }, { key: "highest_win", label: "Best game", short: "BEST GAME" }]
  const categoryIndex = categories.findIndex((item) => item.key === category)

  const load = async () => { const { data } = await supabase.from("hunt_predictions").select("*").eq("hunt_id", huntId).order("created_at", { ascending: false }); if (data) setPredictions(data) }
  useEffect(() => {
    // No hunt, nothing to predict: this used to poll a serverless function
    // every second with hunt_id="" for as long as the page was open.
    if (!huntId) return
    load()
    // The window status, from the server. Every three seconds rather than
    // every one — it changes when an admin opens or closes predictions, and
    // the countdown to closes_at runs off the local clock below, so a close
    // still lands on time. One request at a time, and none from a hidden tab.
    let inFlight = false
    const refreshStatus = async () => {
      if (inFlight || document.hidden) return
      inFlight = true
      try {
        const response = await fetch(`/api/admin/predictions?hunt_id=${encodeURIComponent(huntId)}`, { cache: "no-store" })
        if (!response.ok) return
        const payload = await response.json()
        setWindow(payload.window ?? { status: "closed", opens_at: null, closes_at: null })
        setResolved({ actual_highest_multi: payload.hunt?.best_multiplier ?? null, actual_final_balance: payload.hunt?.total_won == null ? null : Number(payload.hunt.total_won), actual_best_game: payload.hunt?.best_cash_win_game ?? null })
      } catch {
        // A dropped poll is retried on the next one.
      } finally {
        inFlight = false
      }
    }
    refreshStatus()
    const clockTimer = globalThis.setInterval(() => setClock(Date.now()), 1000)
    const statusTimer = globalThis.setInterval(refreshStatus, 3000)
    const channel = supabase.channel(`public-predictions-${huntId}`).on("postgres_changes", { event: "*", schema: "public", table: "hunt_predictions", filter: `hunt_id=eq.${huntId}` }, load).subscribe()
    return () => { globalThis.clearInterval(clockTimer); globalThis.clearInterval(statusTimer); supabase.removeChannel(channel) }
  }, [huntId])
  useEffect(() => { const mine = predictions.find((prediction) => prediction.username === currentUsername); if (mine) setForm({ highest_multi: mine.predicted_max_multiplier?.toString() || "", best_game: mine.predicted_best_game || "", final_balance: mine.predicted_end_balance?.toString() || "" }) }, [predictions, currentUsername])

  const slots = Array.from(new Set(hunts.map((hunt) => hunt.game_name).filter(Boolean)))
  const slotImageByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const hunt of hunts) {
      if (hunt.game_name && hunt.image_url && !map.has(hunt.game_name.toLowerCase())) {
        map.set(hunt.game_name.toLowerCase(), hunt.image_url)
      }
    }
    return map
  }, [hunts])
  const actualBestGameImage = resolved.actual_best_game ? slotImageByName.get(resolved.actual_best_game.toLowerCase()) ?? null : null
  const sorted = useMemo(() => {
    if (category === "ending_balance") return [...predictions].filter((p) => p.predicted_end_balance != null).sort((a, b) => resolved.actual_final_balance == null ? b.predicted_end_balance - a.predicted_end_balance : Math.abs(a.predicted_end_balance - resolved.actual_final_balance) - Math.abs(b.predicted_end_balance - resolved.actual_final_balance)).slice(0, 3)
    if (category === "highest_multi") return [...predictions].filter((p) => p.predicted_max_multiplier != null).sort((a, b) => resolved.actual_highest_multi == null ? b.predicted_max_multiplier - a.predicted_max_multiplier : Math.abs(a.predicted_max_multiplier - resolved.actual_highest_multi) - Math.abs(b.predicted_max_multiplier - resolved.actual_highest_multi)).slice(0, 3)
    const list = [...predictions].filter((p) => p.predicted_best_game)
    if (resolved.actual_best_game) list.sort((a, b) => (String(a.predicted_best_game).toLowerCase() === resolved.actual_best_game!.toLowerCase() ? 0 : 1) - (String(b.predicted_best_game).toLowerCase() === resolved.actual_best_game!.toLowerCase() ? 0 : 1))
    return list.slice(0, 3)
  }, [category, predictions, resolved])
  const actual = category === "ending_balance" ? resolved.actual_final_balance : category === "highest_multi" ? resolved.actual_highest_multi : resolved.actual_best_game
  const noBestGameWinner = category === "highest_win" && resolved.actual_best_game != null && !predictions.some((prediction) => String(prediction.predicted_best_game).toLowerCase() === resolved.actual_best_game!.toLowerCase())
  const closeTime = window.closes_at ? Date.parse(window.closes_at) : null
  const windowOpen = window.status === "open" && closeTime !== null && Number.isFinite(closeTime) && clock < closeTime
  const secondsLeft = windowOpen && closeTime ? Math.max(0, Math.ceil((closeTime - clock) / 1000)) : 0
  const mine = predictions.find((prediction) => prediction.username === currentUsername)
  const canSubmit = isLoggedIn && windowOpen

  useEffect(() => {
    if (windowOpen && message.toLowerCase().startsWith("predictions are closed")) setMessage("")
  }, [windowOpen, message])
  const isRowMatch = (prediction: any, index: number) => category === "highest_win" ? !!resolved.actual_best_game && String(prediction.predicted_best_game).toLowerCase() === resolved.actual_best_game.toLowerCase() : index === 0 && actual != null
  const subtext = (prediction: any) => category === "ending_balance" ? (resolved.actual_final_balance != null ? `Difference: $${Math.abs(prediction.predicted_end_balance - resolved.actual_final_balance).toFixed(2)}` : "Awaiting result") : category === "highest_multi" ? (resolved.actual_highest_multi != null ? `Difference: ${Math.abs(prediction.predicted_max_multiplier - resolved.actual_highest_multi).toFixed(2)}x` : "Awaiting result") : resolved.actual_best_game ? (String(prediction.predicted_best_game).toLowerCase() === resolved.actual_best_game.toLowerCase() ? "Matched" : "Not matched") : "Awaiting result"
  const rowValue = (prediction: any) => category === "ending_balance" ? `$${Number(prediction.predicted_end_balance).toFixed(2)}` : category === "highest_multi" ? `${Number(prediction.predicted_max_multiplier).toFixed(2)}x` : prediction.predicted_best_game

  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!canSubmit) return setMessage("Predictions are closed for this round."); if (!form.final_balance || !form.highest_multi || !form.best_game) return setMessage("Complete all three picks first."); setSubmitting(true); const response = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hunt_id: huntId, highest_multi: form.highest_multi, best_game: form.best_game, final_balance: form.final_balance }) }); const data = await response.json(); setMessage(response.ok ? "Prediction saved." : data.error || "Could not save prediction."); if (response.ok) await load(); setSubmitting(false) }

  const accent = "#5B8DEF"
  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
  const targetText =
    actual == null
      ? "Awaiting result"
      : category === "ending_balance"
        ? `$${Number(actual).toFixed(2)}`
        : category === "highest_multi"
          ? `${Number(actual).toFixed(2)}x`
          : String(actual)

  // The panel in the landing page's language: a bento frame, the bracketed
  // label and a status pill, a pill switch for the three categories, the
  // target in a dot-field panel, the top three, then your own pick.
  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: accent }}
      />

      <div className="relative flex items-center justify-between gap-3 px-3 pb-3 pt-2">
        <span className="font-geist-mono flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
          <Sparkles className="h-3.5 w-3.5" style={{ color: accent }} />
          Predictions
        </span>
        <span
          className="font-geist-mono flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] uppercase tracking-[0.12em] tabular-nums"
          style={
            windowOpen
              ? { borderColor: "#46C48A55", backgroundColor: "#46C48A14", color: "#46C48A" }
              : { borderColor: "rgb(255 255 255 / 0.08)", color: "rgb(255 255 255 / 0.4)" }
          }
        >
          {windowOpen ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          ) : (
            <Lock className="h-3 w-3" />
          )}
          {windowOpen ? `Open · ${countdown}` : "Closed"}
        </span>
      </div>

      {/* The three categories as one pill switch, instead of arrows and dots. */}
      <div className="relative mx-1 grid grid-cols-3 rounded-full border border-white/[0.08] bg-black/20 p-1">
        {categories.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setCategory(item.key)}
            className={`h-8 truncate rounded-full px-2 text-[12.5px] font-medium transition ${
              item.key === category ? "bg-white text-black" : "text-white/45 hover:text-white"
            }`}
          >
            {item.key === "ending_balance" ? "Balance" : item.key === "highest_multi" ? "Multi" : "Game"}
          </button>
        ))}
      </div>

      <div className="relative flex flex-1 flex-col overflow-y-auto px-1 pt-3 [scrollbar-width:none]">
        {/* The target: what the hunt actually came to, once it has. */}
        <div
          key={category}
          className="prediction-category-transition lp-dots relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0d10] p-4"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(70% 80% at 85% 0%, ${accent}24, transparent 70%)` }}
          />
          <div className="relative">
            <span className="font-geist-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em]" style={{ color: accent }}>
              <Trophy className="h-3 w-3" />
              {categories[categoryIndex]?.label}
            </span>
            {category === "highest_win" && actual != null ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="relative aspect-[180/236] w-10 shrink-0 overflow-hidden rounded-md border border-white/[0.10] bg-black/40">
                  {actualBestGameImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                    <img src={actualBestGameImage} alt={String(actual)} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-white/20" />
                  )}
                </span>
                <p className="text-balance text-[16px] font-semibold leading-tight text-white">{actual}</p>
              </div>
            ) : (
              <p
                className={`mt-3 font-semibold leading-none tracking-[-0.03em] tabular-nums ${
                  actual == null ? "text-[22px] text-white/45" : "text-[30px] text-white"
                }`}
              >
                {targetText}
              </p>
            )}
            <p className="mt-2 text-[12px] text-white/35">
              {actual == null ? "Closest picks win when the hunt ends." : "Final result for this round."}
            </p>
          </div>
        </div>

        {/* The top three. */}
        <div key={`leaderboard-${category}`} className="prediction-leaderboard-transition mt-3">
          <p className="font-geist-mono mb-2 px-1 text-[10.5px] uppercase tracking-[0.14em] text-white/30">
            {actual == null ? "Leading picks" : "Closest picks"}
          </p>
          {noBestGameWinner ? (
            <div className="rounded-xl border border-dashed border-white/[0.10] px-4 py-6 text-center">
              <p className="font-geist-mono text-[10.5px] uppercase tracking-[0.12em] text-white/30">No winner this round</p>
            </div>
          ) : (
            <ol className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
              {[0, 1, 2].map((index) => {
                const prediction = sorted[index]
                if (!prediction) {
                  return (
                    <li key={index} className="flex h-[52px] items-center gap-3 border-b border-white/[0.05] px-3 last:border-b-0">
                      <span className="font-geist-mono w-5 text-[11px] tabular-nums text-white/20">{String(index + 1).padStart(2, "0")}</span>
                      <span className="text-[12.5px] text-white/20">Open spot</span>
                    </li>
                  )
                }
                const matched = isRowMatch(prediction, index)
                return (
                  <li
                    key={prediction.id}
                    className="flex h-[52px] items-center gap-3 border-b border-white/[0.05] px-3 last:border-b-0"
                    style={matched ? { backgroundColor: `${accent}12` } : undefined}
                  >
                    <span className="font-geist-mono w-5 text-[11px] tabular-nums" style={{ color: index === 0 ? accent : "rgb(255 255 255 / 0.3)" }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-white/85">{prediction.username}</p>
                      <p className="truncate text-[11px] text-white/30">{subtext(prediction)}</p>
                    </div>
                    <p
                      className="max-w-[45%] truncate text-right text-[13.5px] font-semibold tabular-nums"
                      style={{ color: matched || index === 0 ? accent : "rgb(255 255 255 / 0.7)" }}
                    >
                      {rowValue(prediction)}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Your own pick. */}
        <div className="mt-4 border-t border-white/[0.06] px-1 pb-2 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[14px] font-medium text-white">Your prediction</p>
            {!isLoggedIn && <span className="text-[11.5px] text-white/35">Log in to take part</span>}
          </div>
          {windowOpen ? (
            <form onSubmit={submit} className="animate-in fade-in slide-in-from-bottom-2 space-y-2 duration-300">
              <div className="grid grid-cols-2 gap-2">
                <input disabled={!canSubmit} aria-label="Highest multiplier" type="number" step="0.01" placeholder="Peak multi" value={form.highest_multi} onChange={(e) => setForm({ ...form, highest_multi: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25" />
                <input disabled={!canSubmit} aria-label="Final balance" type="number" step="0.01" placeholder="Final balance" value={form.final_balance} onChange={(e) => setForm({ ...form, final_balance: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25" />
              </div>
              <SelectMenu
                disabled={!canSubmit}
                aria-label="Best game"
                placeholder="Select best game"
                value={form.best_game}
                onChange={(value) => setForm({ ...form, best_game: value })}
                options={slots.map((slot) => ({ value: slot, label: slot }))}
              />
              <button type="submit" disabled={submitting || !canSubmit} className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-medium text-black transition hover:bg-white/90 disabled:opacity-40">
                {submitting ? "Saving..." : mine ? "Update prediction" : "Lock in prediction"}
                <ArrowRight className="h-4 w-4" />
              </button>
              {message && <p className="text-center text-[11.5px] text-white/45">{message}</p>}
            </form>
          ) : mine ? (
            <div className="rounded-xl border p-3" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}0d` }}>
              <p className="font-geist-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: accent }}>Your saved pick</p>
              <dl className="mt-2.5 grid grid-cols-3 gap-2">
                {[
                  ["Balance", `$${mine.predicted_end_balance}`],
                  ["Multi", `${mine.predicted_max_multiplier}x`],
                  ["Game", mine.predicted_best_game],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[10.5px] text-white/35">{label}</dt>
                    <dd className="truncate text-[12.5px] font-medium tabular-nums text-white/80">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.10] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-white/35">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <p className="text-[12.5px] leading-snug text-white/40">
                Predictions open before the opening starts. Call the final balance for a shot at the prize.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
