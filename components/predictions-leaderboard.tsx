"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ChevronLeft, ChevronRight, ImageIcon, Lock, Sparkles, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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
  useEffect(() => { load(); const refreshStatus = async () => { const response = await fetch(`/api/admin/predictions?hunt_id=${encodeURIComponent(huntId)}`, { cache: "no-store" }); if (!response.ok) return; const payload = await response.json(); setWindow(payload.window ?? { status: "closed", opens_at: null, closes_at: null }); setResolved({ actual_highest_multi: payload.hunt?.best_multiplier ?? null, actual_final_balance: payload.hunt?.total_won == null ? null : Number(payload.hunt.total_won), actual_best_game: payload.hunt?.best_cash_win_game ?? null }) }; refreshStatus(); const statusTimer = globalThis.setInterval(() => { setClock(Date.now()); refreshStatus() }, 1000); const channel = supabase.channel(`public-predictions-${huntId}`).on("postgres_changes", { event: "*", schema: "public", table: "hunt_predictions", filter: `hunt_id=eq.${huntId}` }, load).subscribe(); return () => { globalThis.clearInterval(statusTimer); supabase.removeChannel(channel) } }, [huntId])
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
  const goToCategory = (delta: number) => setCategory(categories[(categoryIndex + delta + categories.length) % categories.length].key)

  useEffect(() => {
    if (windowOpen && message.toLowerCase().startsWith("predictions are closed")) setMessage("")
  }, [windowOpen, message])
  const isRowMatch = (prediction: any, index: number) => category === "highest_win" ? !!resolved.actual_best_game && String(prediction.predicted_best_game).toLowerCase() === resolved.actual_best_game.toLowerCase() : index === 0 && actual != null
  const subtext = (prediction: any) => category === "ending_balance" ? (resolved.actual_final_balance != null ? `Difference: $${Math.abs(prediction.predicted_end_balance - resolved.actual_final_balance).toFixed(2)}` : "Awaiting result") : category === "highest_multi" ? (resolved.actual_highest_multi != null ? `Difference: ${Math.abs(prediction.predicted_max_multiplier - resolved.actual_highest_multi).toFixed(2)}x` : "Awaiting result") : resolved.actual_best_game ? (String(prediction.predicted_best_game).toLowerCase() === resolved.actual_best_game.toLowerCase() ? "Matched" : "Not matched") : "Awaiting result"
  const rowValue = (prediction: any) => category === "ending_balance" ? `$${Number(prediction.predicted_end_balance).toFixed(2)}` : category === "highest_multi" ? `${Number(prediction.predicted_max_multiplier).toFixed(2)}x` : prediction.predicted_best_game

  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!canSubmit) return setMessage("Predictions are closed for this round."); if (!form.final_balance || !form.highest_multi || !form.best_game) return setMessage("Complete all three picks first."); setSubmitting(true); const response = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hunt_id: huntId, highest_multi: form.highest_multi, best_game: form.best_game, final_balance: form.final_balance }) }); const data = await response.json(); setMessage(response.ok ? "Prediction saved." : data.error || "Could not save prediction."); if (response.ok) await load(); setSubmitting(false) }

  return <section className="flex h-full flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.022]">
    <div className="shrink-0 border-b border-white/[0.08] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#5B8DEF]"><Sparkles className="h-4 w-4" /> Winners</div>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">{categories[categoryIndex]?.short}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="font-mono text-[10px] tabular-nums text-white/30">{categoryIndex + 1} / {categories.length}</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/25"><Lock className="h-3.5 w-3.5" /> {windowOpen ? `Open · ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "Closed"}</span>
        </div>
      </div>
    </div>
    <div className="flex-1 p-5 sm:p-6">
      <div key={category} className="prediction-category-transition mb-5 flex h-[132px] flex-col items-center justify-center rounded-xl border border-[#5B8DEF]/20 bg-[#5B8DEF]/[0.06] px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5B8DEF]/70"><Trophy className="h-3.5 w-3.5" /> Target</div>
        {category === "highest_win" && actual != null ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="relative aspect-[180/236] w-11 shrink-0 overflow-hidden rounded-lg border border-[#5B8DEF]/20 bg-black/40">
              {actualBestGameImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable slot-thumbnail host
                <img src={actualBestGameImage || "/placeholder.svg"} alt={String(actual)} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-white/20" />
              )}
            </span>
            <p className="text-balance text-left text-[15px] font-semibold text-white">{actual}</p>
          </div>
        ) : (
          <p className="mt-2 text-balance text-[18px] font-semibold text-[#5B8DEF] sm:text-[20px]">{actual == null ? "Awaiting result" : category === "ending_balance" ? `$${Number(actual).toFixed(2)}` : `${Number(actual).toFixed(2)}x`}</p>
        )}
      </div>
      <div key={`leaderboard-${category}`} className="prediction-leaderboard-transition space-y-2">
        {noBestGameWinner ? <div className="flex items-center gap-3 rounded-lg border border-dashed border-white/[0.10] px-4 py-6 text-center">
          <p className="w-full font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">No winner this round</p>
        </div> : [0, 1, 2].map((index) => {
          const prediction = sorted[index]
          if (!prediction) return <div key={index} className="flex items-center gap-3 rounded-lg border border-dashed border-white/[0.10] p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[11px] font-semibold text-white/25">{index + 1}</span><div className="h-4 flex-1" /></div>
          const matched = isRowMatch(prediction, index)
          return <div key={prediction.id} className={`flex items-center gap-3 rounded-lg border p-3 ${matched ? "border-[#5B8DEF]/25 bg-[#5B8DEF]/[0.06]" : "border-white/[0.08] bg-white/[0.022]"}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.07] text-[11px] font-semibold text-white/45">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-white/80">{prediction.username}</p>
              <p className="mt-0.5 text-[11px] text-white/30">{subtext(prediction)}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold tabular-nums text-[#5B8DEF]">{rowValue(prediction)}</p>
            </div>
          </div>
        })}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" aria-label="Previous prediction category" onClick={() => goToCategory(-1)} className="rounded-md border border-white/[0.08] p-2 text-white/35 transition hover:border-white/20 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
        <div className="flex items-center gap-1.5">{categories.map((item) => <button key={item.key} type="button" aria-label={`Show ${item.label}`} onClick={() => setCategory(item.key)} className={`h-1.5 rounded-full transition-all duration-200 ${item.key === category ? "w-6 bg-[#5B8DEF]" : "w-1.5 bg-white/15 hover:bg-white/30"}`} />)}</div>
        <button type="button" aria-label="Next prediction category" onClick={() => goToCategory(1)} className="rounded-md border border-white/[0.08] p-2 text-white/35 transition hover:border-white/20 hover:text-white"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="mt-6 border-t border-white/[0.08] pt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Your prediction</p>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/25"><Lock className="h-3.5 w-3.5" /> {windowOpen ? `Open · ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "Closed"}</span>
        </div>
        {windowOpen ? <form onSubmit={submit} className="animate-in fade-in slide-in-from-bottom-2 space-y-2.5 duration-300">
          <div className="grid grid-cols-2 gap-2">
            <input disabled={!canSubmit} aria-label="Highest multiplier" type="number" step="0.01" placeholder="Peak multi" value={form.highest_multi} onChange={(e) => setForm({ ...form, highest_multi: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12.5px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25" />
            <input disabled={!canSubmit} aria-label="Final balance" type="number" step="0.01" placeholder="Final balance" value={form.final_balance} onChange={(e) => setForm({ ...form, final_balance: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-[12.5px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25" />
          </div>
          <select disabled={!canSubmit} aria-label="Best game" value={form.best_game} onChange={(e) => setForm({ ...form, best_game: e.target.value })} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-[12.5px] text-white/80 outline-none transition focus:border-white/25">
            <option value="">Select best game</option>
            {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
          </select>
          <button type="submit" disabled={submitting || !canSubmit} className="flex w-full items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12] disabled:opacity-50">{submitting ? "Saving..." : mine ? "Update prediction" : "Lock in prediction"}<ArrowRight className="h-3.5 w-3.5" /></button>
          {message && <p className="text-center text-[11px] text-white/40">{message}</p>}
        </form> : <div className="animate-in fade-in flex flex-col items-center justify-center px-4 py-8 text-center duration-300">
          <Lock className="h-6 w-6 text-white/30" />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">Predictions are closed</p>
          {mine ? <div className="mt-3 w-full rounded-md border border-[#5B8DEF]/20 bg-[#5B8DEF]/[0.05] p-3 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5B8DEF]">Your saved prediction</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-white/60">
              <span>Peak: {mine.predicted_max_multiplier}x</span>
              <span>Balance: ${mine.predicted_end_balance}</span>
              <span>Game: {mine.predicted_best_game}</span>
            </div>
          </div> : <p className="mt-2 text-[12px] text-white/30">Predict once the hunt opens for a shot at the prize pool.</p>}
        </div>}
      </div>
    </div>
  </section>
}
