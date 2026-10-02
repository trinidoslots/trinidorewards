"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { MODAL_BACKDROP } from "@/lib/modal-backdrop"
import { ChevronRight, Crosshair, Target, Trophy, X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { Empty, ProfileCard, StatusPill } from "@/components/profile-panels"
import { useProfileData } from "@/lib/profile-data"
import { multiColor } from "@/components/hunt-kpi-board"

/**
 * The profile's Predictions tab: every bonus hunt balance the user called,
 * placed or not, and how close it came.
 *
 * The data comes from /api/profile/predictions; ProfilePredictions loads it
 * when the tab is first opened.
 */

export type PredictionResult = {
  id: string
  huntId: string
  huntName: string
  streamer: string
  predictedAt: string
  guess: number
  /** Also predicted, when the hunt asked for them. */
  guessMulti?: number | null
  guessGame?: string | null
  hunt: {
    status: "running" | "ended"
    startingBalance: number
    finalBalance: number | null
    bestMulti?: number | null
    bestGame?: string | null
    endedAt?: string | null
  }
  /** Place among everyone who predicted this hunt, 1 = closest. Null while it runs. */
  place: number | null
  of: number
  /** The closest three, for the modal. */
  top: { username: string; guess: number; you?: boolean }[]
}

const GOLD = "#F5C542"
const SILVER = "#C9CED6"
const BRONZE = "#D08A4E"
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const money = (value: number) =>
  "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

function placeColor(place: number | null) {
  return place === 1 ? GOLD : place === 2 ? SILVER : place === 3 ? BRONZE : null
}

/** How far off, in dollars and as a share of the final balance. */
function offBy(result: PredictionResult) {
  if (result.hunt.finalBalance == null) return null
  const diff = result.guess - result.hunt.finalBalance
  const share = result.hunt.finalBalance > 0 ? Math.abs(diff) / result.hunt.finalBalance : 1
  return { diff, abs: Math.abs(diff), share }
}

/** Green within 5 %, amber within 20 %, red beyond. */
function accuracyColor(share: number) {
  return share <= 0.05 ? ACCENTS.green : share <= 0.2 ? ACCENTS.amber : ACCENTS.red
}

/** The tab as the profile mounts it: loads the predictions, then shows them. */
export function ProfilePredictions() {
  const { data, failed } = useProfileData<{ results: PredictionResult[] }>("/api/profile/predictions")
  const results = data?.results ?? null

  if (failed && !results) {
    return (
      <ProfileCard title="Predictions" accent="amber">
        <Empty icon={<Target className="h-7 w-7 text-white/15" />} text="Your predictions could not be loaded" note="Try again in a moment." />
      </ProfileCard>
    )
  }
  if (!results) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-[104px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
          ))}
        </div>
        <div className="h-[300px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
      </div>
    )
  }
  return <PredictionsTab results={results} />
}

export function PredictionsTab({ results }: { results: PredictionResult[] }) {
  const [open, setOpen] = useState<PredictionResult | null>(null)

  const summary = useMemo(() => {
    const ended = results.filter((result) => result.hunt.finalBalance != null)
    const offs = ended.map((result) => offBy(result)!).filter(Boolean)
    const best = ended.reduce<number | null>((min, result) => (result.place != null && (min == null || result.place < min) ? result.place : min), null)
    const closest = offs.reduce<number | null>((min, off) => (min == null || off.abs < min ? off.abs : min), null)
    const average = offs.length ? offs.reduce((sum, off) => sum + off.share, 0) / offs.length : null
    const podiums = ended.filter((result) => result.place != null && result.place <= 3).length
    return { made: results.length, best, closest, average, podiums }
  }, [results])

  if (results.length === 0) {
    return (
      <ProfileCard title="Predictions" accent="amber">
        <Empty
          icon={<Target className="h-7 w-7 text-white/15" />}
          text="No predictions yet"
          note="Call the final balance of a bonus hunt and it shows up here, with how close you came."
        />
      </ProfileCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure label="Predictions" value={summary.made.toLocaleString("en-US")} accent={ACCENTS.amber} />
        <Figure
          label="Best place"
          value={summary.best != null ? `#${summary.best}` : "—"}
          accent={placeColor(summary.best) ?? ACCENTS.blue}
          hint={summary.podiums > 0 ? `${summary.podiums}× in the top 3` : undefined}
        />
        <Figure label="Closest call" value={summary.closest != null ? money(summary.closest) : "—"} accent={ACCENTS.green} hint="off the final balance" />
        <Figure
          label="Average miss"
          value={summary.average != null ? `${(summary.average * 100).toFixed(1)}%` : "—"}
          accent={summary.average != null ? accuracyColor(summary.average) : ACCENTS.slate}
        />
      </div>

      <ProfileCard title="Your predictions" accent="amber" right={<MonoLabel className="text-white/35">{results.length}</MonoLabel>}>
        <ul className="divide-y divide-white/[0.06]">
          {results.map((result) => {
            const off = offBy(result)
            const medal = placeColor(result.place)
            const date = new Date(result.predictedAt)
            return (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => setOpen(result)}
                  className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition hover:bg-white/[0.02]"
                >
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-md border border-white/[0.08] bg-black/30 py-1.5">
                    <MonoLabel className="text-white/40">{date.toLocaleDateString("en-US", { month: "short" })}</MonoLabel>
                    <span className="mt-0.5 text-[17px] font-black leading-none tabular-nums text-white">{date.getDate()}</span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-white">{result.huntName}</span>
                    <span className="block text-[12.5px] text-white/45">
                      You said <span className="font-semibold tabular-nums text-white/80">{money(result.guess)}</span>
                      {result.hunt.finalBalance != null && (
                        <>
                          {" "}· final <span className="tabular-nums text-white/70">{money(result.hunt.finalBalance)}</span>
                        </>
                      )}
                    </span>
                  </span>

                  {result.hunt.status === "running" ? (
                    <StatusPill accent="blue">Hunt running</StatusPill>
                  ) : (
                    <>
                      {off && (
                        <span className="text-right">
                          <span className="block text-[14px] font-bold tabular-nums" style={{ color: accuracyColor(off.share) }}>
                            {off.diff >= 0 ? "+" : "−"}
                            {money(off.abs)}
                          </span>
                          <span className="block text-[11.5px] tabular-nums text-white/40">{(off.share * 100).toFixed(1)}% off</span>
                        </span>
                      )}
                      {result.place != null && (
                        <span
                          className="flex h-9 min-w-[3.25rem] flex-col items-center justify-center rounded-md border px-2"
                          style={{
                            borderColor: medal ? `${medal}66` : "rgba(255,255,255,0.10)",
                            backgroundColor: medal ? `${medal}14` : "rgba(255,255,255,0.02)",
                          }}
                        >
                          <span className="text-[14px] font-black leading-none tabular-nums" style={{ color: medal ?? "#fff" }}>
                            #{result.place}
                          </span>
                          <span className="mt-0.5 text-[9.5px] tabular-nums text-white/35">of {result.of}</span>
                        </span>
                      )}
                    </>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
                </button>
              </li>
            )
          })}
        </ul>
      </ProfileCard>

      <ResultModal result={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function Figure({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12] p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: accent }} />
      <MonoLabel style={{ color: accent }}>{label}</MonoLabel>
      <p className="mt-3 text-[26px] font-black leading-none tabular-nums tracking-[-0.02em] text-white">{value}</p>
      {hint && <p className="mt-2 text-[12px] text-white/40">{hint}</p>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Result modal                                */
/* -------------------------------------------------------------------------- */

/**
 * One hunt: what you called, what it finished on, and where that put you.
 *
 * The number line shows the final balance in the middle and every guess
 * around it — yours highlighted, the top three marked — so "how far off"
 * is something you see, not just a figure.
 */
function ResultModal({ result, onClose }: { result: PredictionResult | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!result) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [result, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {result && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          {...MODAL_BACKDROP}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Prediction for ${result.huntName}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.10] bg-[#0E0E12] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
          >
            <ModalBody result={result} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function ModalBody({ result, onClose }: { result: PredictionResult; onClose: () => void }) {
  const off = offBy(result)
  const final = result.hunt.finalBalance
  const medal = placeColor(result.place)
  const amber = ACCENTS.amber

  return (
    <>
      <div className="relative overflow-hidden border-b border-white/[0.07] px-6 pb-5 pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(380px 200px at 85% -30%, ${amber}26, transparent 65%)` }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: amber }} />
            <MonoLabel style={{ color: amber }}>Predicted {day(result.predictedAt)}</MonoLabel>
          </div>
          <p className="mt-3 text-[26px] font-black uppercase leading-none tracking-[-0.01em] text-white">{result.huntName}</p>
          <p className="mt-2 text-[13px] text-white/45">
            Start {money(result.hunt.startingBalance)}
            {result.hunt.endedAt ? ` · ended ${day(result.hunt.endedAt)}` : " · still running"}
          </p>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        {/* Guess against the result. */}
        <dl className="grid grid-cols-2 divide-x divide-white/[0.07] rounded-lg border border-white/[0.07]">
          <div className="px-4 py-3.5">
            <dt>
              <MonoLabel className="text-white/40">Your guess</MonoLabel>
            </dt>
            <dd className="mt-1 text-[22px] font-black tabular-nums text-white">{money(result.guess)}</dd>
          </div>
          <div className="px-4 py-3.5">
            <dt>
              <MonoLabel className="text-white/40">Final balance</MonoLabel>
            </dt>
            <dd className="mt-1 text-[22px] font-black tabular-nums" style={{ color: final != null ? ACCENTS.green : "rgba(255,255,255,0.35)" }}>
              {final != null ? money(final) : "Running"}
            </dd>
          </div>
        </dl>

        {off && final != null ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[15px] text-white/70">
                Off by{" "}
                <span className="font-bold tabular-nums" style={{ color: accuracyColor(off.share) }}>
                  {money(off.abs)}
                </span>{" "}
                <span className="text-white/45">
                  ({(off.share * 100).toFixed(1)}% {off.diff >= 0 ? "too high" : "too low"})
                </span>
              </span>
              {result.place != null && (
                <span
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-bold tabular-nums"
                  style={{
                    borderColor: medal ? `${medal}66` : "rgba(255,255,255,0.12)",
                    color: medal ?? "#fff",
                    backgroundColor: medal ? `${medal}14` : "transparent",
                  }}
                >
                  {medal && <Trophy className="h-3.5 w-3.5" />}#{result.place} of {result.of}
                </span>
              )}
            </div>
            <NumberLine result={result} final={final} />
          </>
        ) : (
          <p className="text-[13.5px] text-white/50">The hunt is still running. Your place shows here once it ends.</p>
        )}

        {/* The closest three, with you underneath when you are not among them. */}
        {result.top.length > 0 && final != null && (
          <div>
            <MonoLabel className="mb-2 block text-white/40">Closest calls</MonoLabel>
            <ol className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.07]">
              {result.top.map((entry, index) => (
                <Row key={entry.username} place={index + 1} username={entry.you ? "You" : entry.username} guess={entry.guess} final={final} you={entry.you} />
              ))}
              {result.place != null && result.place > 3 && (
                <Row place={result.place} username="You" guess={result.guess} final={final} you />
              )}
            </ol>
          </div>
        )}

        {/* Best multiplier and best game, always: the hunt's own result, and
            the guess beside it when one was made. While it runs, the best so far. */}
        <dl className="grid grid-cols-2 gap-3 text-[13px]">
          <SideResult
            label="Best multiplier"
            running={result.hunt.status === "running"}
            real={result.hunt.bestMulti != null ? `${result.hunt.bestMulti.toLocaleString("en-US")}x` : null}
            realColor={result.hunt.bestMulti != null ? multiColor(result.hunt.bestMulti) : undefined}
            guess={result.guessMulti != null ? `${result.guessMulti.toLocaleString("en-US")}x` : null}
            hit={
              result.guessMulti != null && result.hunt.bestMulti != null && result.hunt.status === "ended"
                ? Math.abs(result.guessMulti - result.hunt.bestMulti) / result.hunt.bestMulti <= 0.1
                : false
            }
          />
          <SideResult
            label="Best game"
            running={result.hunt.status === "running"}
            real={result.hunt.bestGame ?? null}
            guess={result.guessGame ?? null}
            hit={
              !!result.guessGame &&
              !!result.hunt.bestGame &&
              result.hunt.status === "ended" &&
              result.guessGame.trim().toLowerCase() === result.hunt.bestGame.trim().toLowerCase()
            }
          />
        </dl>
      </div>
    </>
  )
}

/**
 * One side result: what the hunt produced, and the guess for it.
 *
 * A guess within 10 % of the best multiplier, or naming the right game,
 * gets a tick.
 */
function SideResult({
  label,
  running,
  real,
  realColor,
  guess,
  hit,
}: {
  label: string
  running: boolean
  real: string | null
  realColor?: string
  guess: string | null
  hit: boolean
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/[0.07] px-4 py-3">
      <dt>
        <MonoLabel className="text-white/40">{running ? `${label} so far` : label}</MonoLabel>
      </dt>
      <dd className="mt-1.5 truncate text-[15px] font-bold" style={{ color: real ? (realColor ?? "#fff") : "rgba(255,255,255,0.35)" }}>
        {real ?? (running ? "Not yet" : "—")}
      </dd>
      <dd className="mt-1 truncate text-[12px] text-white/45">
        {guess ? (
          <>
            You: <span className="font-semibold text-white/80">{guess}</span>
            {hit && <span style={{ color: ACCENTS.green }}> ✓</span>}
          </>
        ) : (
          "No guess"
        )}
      </dd>
    </div>
  )
}

function Row({ place, username, guess, final, you }: { place: number; username: string; guess: number; final: number; you?: boolean }) {
  const medal = placeColor(place)
  const diff = guess - final
  return (
    <li
      className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
      style={you ? { backgroundColor: `${ACCENTS.amber}12` } : undefined}
    >
      <span className="w-8 shrink-0 font-black tabular-nums" style={{ color: medal ?? "rgba(255,255,255,0.5)" }}>
        #{place}
      </span>
      <span className={`min-w-0 flex-1 truncate ${you ? "font-bold text-white" : "text-white/80"}`}>{username}</span>
      <span className="tabular-nums text-white/70">{money(guess)}</span>
      <span className="w-20 shrink-0 text-right tabular-nums text-white/40">
        {diff >= 0 ? "+" : "−"}
        {money(Math.abs(diff))}
      </span>
    </li>
  )
}

/**
 * The final balance in the middle, guesses either side. The scale stretches
 * to the furthest guess shown, so a close call still reads as close.
 */
function NumberLine({ result, final }: { result: PredictionResult; final: number }) {
  const guesses = [...result.top.map((entry) => entry.guess), result.guess]
  const spread = Math.max(...guesses.map((guess) => Math.abs(guess - final)), final * 0.02, 1) * 1.15
  const at = (value: number) => 50 + ((value - final) / spread) * 50

  return (
    <div className="pt-6">
      <div className="relative h-14">
        {/* Track */}
        <span className="absolute inset-x-0 top-7 h-px bg-white/[0.12]" />
        {/* Final balance, centre */}
        <span className="absolute top-3 h-8 w-0.5 -translate-x-1/2 rounded-full" style={{ left: "50%", backgroundColor: ACCENTS.green }} />
        <span className="absolute -top-3 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold" style={{ left: "50%", color: ACCENTS.green }}>
          Final
        </span>
        {/* The closest three */}
        {result.top.map((entry, index) => (
          <span
            key={entry.username}
            title={`#${index + 1} ${entry.username}`}
            className="absolute top-[22px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#0E0E12]"
            style={{ left: `${at(entry.guess)}%`, backgroundColor: placeColor(index + 1) ?? "#fff" }}
          />
        ))}
        {/* You */}
        <span className="absolute top-[19px] -translate-x-1/2" style={{ left: `${at(result.guess)}%` }}>
          <Crosshair className="h-[18px] w-[18px]" style={{ color: ACCENTS.amber }} />
        </span>
        <span
          className="absolute top-10 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold"
          style={{ left: `${Math.min(92, Math.max(8, at(result.guess)))}%`, color: ACCENTS.amber }}
        >
          You
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] tabular-nums text-white/30">
        <span>{money(Math.max(0, final - spread))}</span>
        <span>{money(final + spread)}</span>
      </div>
    </div>
  )
}
