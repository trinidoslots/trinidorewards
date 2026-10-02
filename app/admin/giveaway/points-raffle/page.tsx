"use client"

import { useCallback, useEffect, useState } from "react"
import { Play, Square, Trophy, XCircle } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, StatTile } from "@/components/ui/panel"
import { formatKeywordForDisplay } from "@/lib/kick-chat"

/**
 * Points raffle: a keyword in Kick chat within a set time enters you, and when
 * the time is up random entrants win points.
 *
 * Unlike the giveaway next door, nothing here has to stay open: the Kick bot's
 * chat webhook collects the entries and the server draws and pays
 * (lib/points-raffle.ts, scripts/089). This page starts, watches and ends it.
 */

type Winner = { username: string; kick_id: string }
type Raffle = {
  id: string
  keyword: string
  points_each: number
  winner_count: number
  starts_at: string
  ends_at: string
  status: "open" | "drawn" | "cancelled"
  drawn_at: string | null
  entry_count: number | null
  eligible_count: number | null
  winners: Winner[]
}
type Entry = { username: string; kick_id: string; entered_at: string; hasAccount: boolean }
type State = {
  open: Raffle | null
  entries: Entry[]
  entryCount: number
  history: Raffle[]
  limits: { minutes: number; winners: number; points: number }
}

const DURATIONS = [1, 2, 3, 5, 10]

const inputClass =
  "h-9 w-full rounded border border-white/[0.08] bg-black/30 px-2.5 text-[13px] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
const buttonClass =
  "flex items-center justify-center gap-1.5 rounded px-3 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40"

function points(value: number) {
  return value.toLocaleString("en-US")
}

function left(endsAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export default function PointsRafflePage() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const [keyword, setKeyword] = useState("!points")
  const [minutes, setMinutes] = useState(2)
  const [pointsEach, setPointsEach] = useState(100)
  const [winners, setWinners] = useState(3)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/points-raffles", { cache: "no-store" })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json) setError(json?.error ?? "Could not load the points raffles.")
    else {
      setError(null)
      setState(json)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // While one runs: the clock every second, entries every three. When the time
  // is up the next read draws it on the server.
  const running = Boolean(state?.open)
  useEffect(() => {
    if (!running) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const poll = setInterval(load, 3000)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [running, load])

  async function send(method: "POST" | "PATCH", body: Record<string, unknown>, label: string) {
    setBusy(label)
    setError(null)
    const res = await fetch("/api/admin/points-raffles", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) setError(json.error ?? "That did not work.")
    setBusy(null)
    await load()
  }

  const open = state?.open ?? null
  const limits = state?.limits ?? { minutes: 120, winners: 100, points: 1_000_000 }
  const valid =
    keyword.trim().length > 0 &&
    minutes >= 1 &&
    minutes <= limits.minutes &&
    pointsEach >= 1 &&
    pointsEach <= limits.points &&
    winners >= 1 &&
    winners <= limits.winners

  return (
    <div className="mx-auto max-w-4xl space-y-3 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Points raffle</h1>
        <p className="text-[13px] text-white/40">
          Everyone who types the keyword in Kick chat before the time runs out is in. Random entrants with an account
          win the points, and the Kick bot announces the start and the winners.
        </p>
      </div>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      {open ? (
        <Panel accent="green" className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: ACCENTS.green }} />
            <MonoLabel style={{ color: ACCENTS.green }}>Running</MonoLabel>
            <span className="ml-1 text-[15px] font-semibold text-white">
              Type <span className="font-mono">{formatKeywordForDisplay(open.keyword)}</span> in chat
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Time left" value={left(open.ends_at, now)} accent="green" />
            <StatTile label="Entries" value={points(state?.entryCount ?? 0)} />
            <StatTile label="Winners" value={points(open.winner_count)} />
            <StatTile label="Points each" value={points(open.points_each)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy !== null}
              onClick={() => send("PATCH", { id: open.id, action: "end" }, "end")}
              className={`${buttonClass} text-black`}
              style={{ background: ACCENTS.green }}
            >
              <Trophy className="h-4 w-4" /> {busy === "end" ? "Drawing…" : "End now and draw"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => {
                if (confirm("Cancel this raffle? Nobody gets points.")) send("PATCH", { id: open.id, action: "cancel" }, "cancel")
              }}
              className={`${buttonClass} bg-white/[0.06] text-white/80 hover:bg-white/[0.1]`}
            >
              <Square className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>

          <div>
            <MonoLabel className="text-white/40">Entrants</MonoLabel>
            {state?.entries.length ? (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {state.entries.map((entry) => (
                  <li
                    key={entry.kick_id}
                    title={entry.hasAccount ? "Has an account – can win" : "No account on the site – cannot win"}
                    className="rounded border px-2 py-0.5 text-[12px]"
                    style={{
                      borderColor: entry.hasAccount ? "rgba(83,252,24,0.3)" : "rgba(255,255,255,0.08)",
                      color: entry.hasAccount ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {entry.username}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[13px] text-white/40">Nobody yet.</p>
            )}
            <p className="mt-2 text-[12px] text-white/35">Greyed out: no account on the site, so they cannot win.</p>
          </div>
        </Panel>
      ) : (
        <Panel className="space-y-3 p-4">
          <div className="text-[14px] font-medium text-white">New points raffle</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <MonoLabel className="text-white/40">Keyword</MonoLabel>
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} maxLength={100} className={inputClass} />
              <span className="block text-[11px] text-white/35">The whole message, any capitalisation.</span>
            </label>
            <div className="space-y-1">
              <MonoLabel className="text-white/40">Duration (minutes)</MonoLabel>
              <div className="flex gap-1.5">
                {DURATIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMinutes(option)}
                    className="h-9 min-w-9 rounded border px-2 text-[13px]"
                    style={{
                      borderColor: minutes === option ? ACCENTS.green : "rgba(255,255,255,0.08)",
                      color: minutes === option ? ACCENTS.green : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {option}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={limits.minutes}
                  value={minutes}
                  onChange={(event) => setMinutes(Math.floor(Number(event.target.value)) || 0)}
                  className={`${inputClass} w-20`}
                  aria-label="Duration in minutes"
                />
              </div>
            </div>
            <label className="space-y-1">
              <MonoLabel className="text-white/40">Points per winner</MonoLabel>
              <input
                type="number"
                min={1}
                max={limits.points}
                value={pointsEach}
                onChange={(event) => setPointsEach(Math.floor(Number(event.target.value)) || 0)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <MonoLabel className="text-white/40">Winners</MonoLabel>
              <input
                type="number"
                min={1}
                max={limits.winners}
                value={winners}
                onChange={(event) => setWinners(Math.floor(Number(event.target.value)) || 0)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={!valid || busy !== null || !state}
              onClick={() => send("POST", { keyword, minutes, pointsEach, winners }, "start")}
              className={`${buttonClass} text-black`}
              style={{ background: ACCENTS.green }}
            >
              <Play className="h-4 w-4" /> {busy === "start" ? "Starting…" : "Start raffle"}
            </button>
            <span className="text-[13px] text-white/50">
              Pays out up to <b className="text-white/80">{points(Math.max(0, pointsEach) * Math.max(0, winners))}</b> points
            </span>
          </div>
        </Panel>
      )}

      <Panel className="p-4">
        <div className="text-[14px] font-medium text-white">Last raffles</div>
        {state?.history.length ? (
          <ul className="mt-2 divide-y divide-white/[0.05]">
            {state.history.map((raffle) => (
              <li key={raffle.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-[13px]">
                <span className="font-mono text-white/80">{formatKeywordForDisplay(raffle.keyword)}</span>
                <span className="text-white/35">
                  {new Date(raffle.drawn_at ?? raffle.ends_at).toLocaleString([], {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {raffle.status === "cancelled" ? (
                  <span className="flex items-center gap-1 text-white/40">
                    <XCircle className="h-3.5 w-3.5" /> Cancelled
                  </span>
                ) : (
                  <span className="text-white/60">
                    {raffle.winners.length
                      ? `${raffle.winners.map((winner) => winner.username).join(", ")} · ${points(raffle.points_each)} each`
                      : "No winner"}
                    <span className="text-white/30">
                      {" "}
                      · {raffle.entry_count ?? 0} entered, {raffle.eligible_count ?? 0} with an account
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-white/40">None yet.</p>
        )}
      </Panel>
    </div>
  )
}
