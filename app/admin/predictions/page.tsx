'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Activity, Check, Clock3, RefreshCw, Search, ShieldCheck, Target, Trash2, Users, X } from 'lucide-react'

interface PredictionSubmission {
  id: string
  username: string
  predicted_max_multiplier: number
  predicted_best_game: string
  predicted_end_balance: number
  created_at: string
}

interface PredictionSettings {
  predictions_enabled: boolean
  predictions_start_time: string | null
  predictions_end_time: string | null
  actual_highest_multi: number | null
  actual_final_balance: number | null
  actual_best_game: string | null
  results_entered_at?: string | null
}

const emptySettings: PredictionSettings = {
  predictions_enabled: false,
  predictions_start_time: null,
  predictions_end_time: null,
  actual_highest_multi: null,
  actual_final_balance: null,
  actual_best_game: null,
  results_entered_at: null,
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function formatTime(value: number) {
  if (value <= 0) return 'Closed'
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export default function PredictionsAdminPage() {
  const [submissions, setSubmissions] = useState<PredictionSubmission[]>([])
  const [settings, setSettings] = useState<PredictionSettings>(emptySettings)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [windowBusy, setWindowBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/predictions', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load predictions')
      setSettings({ ...emptySettings, ...data.settings })
      setSubmissions(data.predictions || [])
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load predictions' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const tick = () => setSecondsLeft(settings.predictions_end_time ? Math.max(0, Math.floor((Date.parse(settings.predictions_end_time) - Date.now()) / 1000)) : 0)
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [settings.predictions_end_time])

  const filteredSubmissions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return submissions.filter((submission) => !normalized || submission.username.toLowerCase().includes(normalized) || submission.predicted_best_game.toLowerCase().includes(normalized))
  }, [query, submissions])

  const windowOpen = settings.predictions_enabled && secondsLeft > 0 && (!settings.predictions_start_time || Date.now() >= Date.parse(settings.predictions_start_time))
  const resolvedCount = [settings.actual_highest_multi, settings.actual_final_balance, settings.actual_best_game].filter((value) => value !== null && value !== '').length

  const setPredictionWindow = async (action: 'open' | 'close') => {
    setWindowBusy(true)
    try {
      const response = await fetch('/api/admin/predictions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update prediction window')
      setMessage({ type: 'success', text: action === 'open' ? 'Predictions opened for 5 minutes.' : 'Predictions closed.' })
      await load()
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not update prediction window' })
    } finally {
      setWindowBusy(false)
    }
  }

  const deletePrediction = async (id: string) => {
    if (!window.confirm('Delete this prediction permanently?')) return
    setBusy(id)
    try {
      const response = await fetch(`/api/admin/predictions/delete?id=${id}`, { method: 'DELETE' })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || 'Delete failed') }
      await load()
      setMessage({ type: 'success', text: 'Prediction deleted.' })
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Delete failed' }) } finally { setBusy(null) }
  }

  const resetRound = async () => {
    if (!window.confirm('Reset the current round, including predictions and resolved outcomes?')) return
    setBusy('reset')
    try {
      const response = await fetch('/api/admin/predictions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || 'Reset failed') }
      setMessage({ type: 'success', text: 'Round reset. Ready for the next KPI resolution.' })
      await load()
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Reset failed' }) } finally { setBusy(null) }
  }

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center text-slate-400">Loading prediction results…</div>

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300"><ShieldCheck className="h-4 w-4" /> KPI results</div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Guess the Balance</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Community picks are captured automatically. The live KPI results below are the single source of truth for resolution.</p>
          </div>
          <div className="flex gap-2"><Button variant="outline" onClick={load} className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={resetRound} disabled={busy === 'reset'} variant="outline" className="border-rose-900/70 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40"><X className="mr-2 h-4 w-4" />Reset round</Button></div>
        </header>

        {message && <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-rose-800 bg-rose-950/30 text-rose-300'}`}>{message.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{message.text}</div>}

        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Prediction window</p><h2 className="mt-1 text-xl font-bold text-white">Open or close community picks</h2><p className="mt-2 text-sm text-slate-400">Opening a round starts a five-minute countdown. New submissions are blocked automatically when it expires.</p></div>
            <div className="flex flex-wrap items-center gap-3"><div className={`rounded-lg border px-4 py-2 text-center ${windowOpen ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-slate-700 bg-slate-900'}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</p><p className={`mt-1 text-sm font-bold ${windowOpen ? 'text-emerald-300' : 'text-slate-300'}`}>{windowOpen ? `${formatTime(secondsLeft)} left` : 'Closed'}</p></div><Button onClick={() => setPredictionWindow(windowOpen ? 'close' : 'open')} disabled={windowBusy} className={windowOpen ? 'border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20' : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'} variant="outline">{windowBusy ? 'Updating...' : windowOpen ? 'Close predictions' : 'Open for 5 minutes'}</Button></div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center justify-between text-slate-400"><span className="text-xs uppercase tracking-wider">Prediction window</span><Activity className="h-4 w-4 text-cyan-300" /></div><p className={`mt-3 text-2xl font-bold ${windowOpen ? 'text-emerald-300' : 'text-slate-200'}`}>{windowOpen ? 'Live' : 'Closed'}</p><p className="mt-1 text-xs text-slate-500">{windowOpen ? `${formatTime(secondsLeft)} remaining` : 'Managed by hunt flow'}</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center justify-between text-slate-400"><span className="text-xs uppercase tracking-wider">Community picks</span><Users className="h-4 w-4 text-cyan-300" /></div><p className="mt-3 text-2xl font-bold text-white">{submissions.length}</p><p className="mt-1 text-xs text-slate-500">{filteredSubmissions.length} visible in table</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center justify-between text-slate-400"><span className="text-xs uppercase tracking-wider">KPI results</span><Target className="h-4 w-4 text-amber-300" /></div><p className="mt-3 text-2xl font-bold text-white">{resolvedCount}<span className="text-base text-slate-500"> / 3</span></p><p className="mt-1 text-xs text-slate-500">Read from the live hunt</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center justify-between text-slate-400"><span className="text-xs uppercase tracking-wider">Last resolved</span><Clock3 className="h-4 w-4 text-cyan-300" /></div><p className="mt-3 text-sm font-semibold text-white">{formatDate(settings.results_entered_at || null)}</p><p className="mt-1 text-xs text-slate-500">KPI source timestamp</p></div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">01 / Resolution source</p><h2 className="mt-1 text-xl font-bold text-white">Live KPI results</h2><p className="mt-2 text-sm text-slate-500">These values are read-only here and come from the completed hunt KPI result.</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">Read only</span></div>
          <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Highest multiplier</p><p className="mt-3 font-mono text-2xl font-bold text-amber-300">{settings.actual_highest_multi == null ? '—' : `${Number(settings.actual_highest_multi).toFixed(2)}x`}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Final balance</p><p className="mt-3 font-mono text-2xl font-bold text-emerald-300">{settings.actual_final_balance == null ? '—' : `$${Number(settings.actual_final_balance).toFixed(2)}`}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Best game</p><p className="mt-3 truncate text-lg font-bold text-cyan-300">{settings.actual_best_game || '—'}</p></div></div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6"><div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">02 / Submissions</p><h2 className="mt-1 text-xl font-bold text-white">Community predictions <span className="text-slate-500">({submissions.length})</span></h2></div><div className="relative w-full md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search username or game" className="border-slate-700 bg-slate-950 pl-9 text-white" /></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="text-[11px] uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Player</th><th className="px-3 py-3">Multiplier</th><th className="px-3 py-3">Best game</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">Submitted</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody>{filteredSubmissions.map((submission) => <tr key={submission.id} className="border-t border-slate-800/80 text-sm"><td className="px-3 py-4 font-semibold text-white">{submission.username}</td><td className="px-3 py-4 font-mono text-amber-300">{Number(submission.predicted_max_multiplier).toFixed(2)}x</td><td className="px-3 py-4 text-cyan-300">{submission.predicted_best_game}</td><td className="px-3 py-4 font-mono text-emerald-300">${Number(submission.predicted_end_balance).toFixed(2)}</td><td className="px-3 py-4 text-xs text-slate-500">{formatDate(submission.created_at)}</td><td className="px-3 py-4 text-right"><Button aria-label={`Delete ${submission.username} prediction`} onClick={() => deletePrediction(submission.id)} disabled={busy === submission.id} variant="ghost" size="icon" className="text-slate-500 hover:bg-rose-950/40 hover:text-rose-300"><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table>{filteredSubmissions.length === 0 && <div className="py-12 text-center text-sm text-slate-500">No community predictions found.</div>}</div></section>
      </div>
    </main>
  )
}
