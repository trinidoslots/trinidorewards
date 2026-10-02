"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, ChevronRight, Gamepad2, Swords, Trophy, X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { Empty, ProfileCard, StatusPill } from "@/components/profile-panels"
import { multiColor } from "@/components/hunt-kpi-board"
import { useProfileData } from "@/lib/profile-data"

/**
 * The profile's Tournaments tab: the brackets the user played, how far they
 * got, and every match on the way. From /api/profile/tournaments, which only
 * finds tournaments the admin linked to this account (scripts/087).
 */

export type TournamentResult = {
  id: string
  tournamentId: string
  title: string
  size: number
  status: "registration" | "running" | "finished"
  date: string
  finishedAt: string | null
  game: string | null
  gameImage: string | null
  buy: number
  casino: string | null
  isSuper: boolean
  outcome: "champion" | "runner_up" | "out" | "playing" | "waiting"
  /** The round they went out in, when they did. */
  outRound: string | null
  matchesWon: number
  bestMulti: number | null
  matches: {
    round: number
    roundName: string
    opponent: { username: string; game: string | null; buy: number } | null
    myPayout: number | null
    theirPayout: number | null
    myMulti: number | null
    theirMulti: number | null
    result: "won" | "lost" | "pending"
  }[]
}

const GOLD = "#F5C542"
const SILVER = "#C9CED6"
const PURPLE = ACCENTS.purple
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const money = (value: number) =>
  "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const multi = (value: number | null) => (value == null ? "—" : `${value.toFixed(2)}x`)
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

/** How the finish is said and coloured. */
function finish(result: TournamentResult): { label: string; color: string } {
  switch (result.outcome) {
    case "champion":
      return { label: "Champion", color: GOLD }
    case "runner_up":
      return { label: "Runner-up", color: SILVER }
    case "out":
      return { label: result.outRound ? `Out in ${result.outRound.toLowerCase()}` : "Out", color: "rgba(255,255,255,0.55)" }
    case "playing":
      return { label: "Still in", color: ACCENTS.green }
    default:
      return { label: "Waiting to start", color: ACCENTS.blue }
  }
}

/** The tab as the profile mounts it, on the shared profile data cache. */
export function ProfileTournaments() {
  const { data, failed } = useProfileData<{ results: TournamentResult[] }>("/api/profile/tournaments")

  if (failed && !data) {
    return (
      <ProfileCard title="Tournaments" accent="purple">
        <Empty icon={<Swords className="h-7 w-7 text-white/15" />} text="Your tournaments could not be loaded" note="Try again in a moment." />
      </ProfileCard>
    )
  }
  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-[104px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
          ))}
        </div>
        <div className="h-[260px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
      </div>
    )
  }
  return <TournamentsTab results={data.results} />
}

export function TournamentsTab({ results }: { results: TournamentResult[] }) {
  const [open, setOpen] = useState<TournamentResult | null>(null)

  const summary = useMemo(() => {
    const titles = results.filter((result) => result.outcome === "champion").length
    const finals = results.filter((result) => result.outcome === "champion" || result.outcome === "runner_up").length
    const won = results.reduce((sum, result) => sum + result.matchesWon, 0)
    const best = results.reduce<number | null>(
      (max, result) => (result.bestMulti != null && (max == null || result.bestMulti > max) ? result.bestMulti : max),
      null,
    )
    return { played: results.length, titles, finals, won, best }
  }, [results])

  if (results.length === 0) {
    return (
      <ProfileCard title="Tournaments" accent="purple">
        <Empty
          icon={<Swords className="h-7 w-7 text-white/15" />}
          text="No tournaments yet"
          note="Brackets you play in show up here, with every match and how far you got."
        />
      </ProfileCard>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure label="Played" value={summary.played.toLocaleString("en-US")} accent={PURPLE} />
        <Figure
          label="Titles"
          value={summary.titles.toLocaleString("en-US")}
          accent={summary.titles > 0 ? GOLD : ACCENTS.slate}
          hint={summary.finals > 0 ? `${summary.finals}× in a final` : undefined}
        />
        <Figure label="Matches won" value={summary.won.toLocaleString("en-US")} accent={ACCENTS.green} />
        <Figure
          label="Best multiplier"
          value={summary.best != null ? `${summary.best.toFixed(2)}x` : "—"}
          accent={summary.best != null ? multiColor(summary.best) : ACCENTS.slate}
        />
      </div>

      <ProfileCard title="Your tournaments" accent="purple" right={<MonoLabel className="text-white/35">{results.length}</MonoLabel>}>
        <ul className="divide-y divide-white/[0.06]">
          {results.map((result) => {
            const { label, color } = finish(result)
            const date = new Date(result.date)
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
                    <span className="block truncate text-[14px] font-semibold text-white">{result.title}</span>
                    <span className="block truncate text-[12.5px] text-white/45">
                      {result.game ?? "No slot set"} · {money(result.buy)}
                      {result.isSuper && <span style={{ color: ACCENTS.amber }}> · Super</span>}
                    </span>
                  </span>

                  <span className="text-right">
                    <span className="block text-[13.5px] font-bold" style={{ color }}>
                      {result.outcome === "champion" && <Trophy className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />}
                      {label}
                    </span>
                    <span className="block text-[11.5px] tabular-nums text-white/40">
                      {result.matchesWon} won · best{" "}
                      <span style={{ color: result.bestMulti != null ? multiColor(result.bestMulti) : undefined }}>{multi(result.bestMulti)}</span>
                    </span>
                  </span>
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

/** One tournament: what they played, and their path through the bracket. */
function ResultModal({ result, onClose }: { result: TournamentResult | null; onClose: () => void }) {
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={result.title}
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

function ModalBody({ result, onClose }: { result: TournamentResult; onClose: () => void }) {
  const { label, color } = finish(result)

  return (
    <>
      <div className="relative overflow-hidden border-b border-white/[0.07] px-6 pb-5 pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(380px 200px at 85% -30%, ${PURPLE}26, transparent 65%)` }}
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
            <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: PURPLE }} />
            <MonoLabel style={{ color: PURPLE }}>
              {day(result.date)} · {result.size} players
            </MonoLabel>
          </div>
          <p className="mt-3 text-[26px] font-black uppercase leading-none tracking-[-0.01em] text-white">{result.title}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-bold" style={{ color }}>
            {result.outcome === "champion" && <Trophy className="h-4 w-4" />}
            {label}
          </p>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        {/* What they played. */}
        <div className="flex items-center gap-3.5 rounded-lg border border-white/[0.07] p-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-black/40">
            {result.gameImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- slot art from any provider host
              <img src={result.gameImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <Gamepad2 className="h-5 w-5 text-white/20" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold text-white">{result.game ?? "No slot set"}</p>
            <p className="text-[12.5px] text-white/45">
              {money(result.buy)}
              {result.casino ? ` · ${result.casino}` : ""}
              {result.isSuper && <span style={{ color: ACCENTS.amber }}> · Super</span>}
            </p>
          </div>
          {result.bestMulti != null && (
            <div className="text-right">
              <MonoLabel className="text-white/40">Best</MonoLabel>
              <p className="text-[16px] font-black tabular-nums" style={{ color: multiColor(result.bestMulti) }}>
                {multi(result.bestMulti)}
              </p>
            </div>
          )}
        </div>

        {/* Their path through the bracket. */}
        <div>
          <MonoLabel className="mb-2 block text-white/40">Your matches</MonoLabel>
          {result.matches.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/[0.10] px-4 py-5 text-center text-[13px] text-white/45">
              {result.status === "registration" ? "The bracket has not started yet." : "No matches played yet."}
            </p>
          ) : (
            <ol className="space-y-2">
              {result.matches.map((match) => {
                const accent = match.result === "won" ? ACCENTS.green : match.result === "lost" ? ACCENTS.red : "rgba(255,255,255,0.35)"
                return (
                  <li
                    key={match.round}
                    className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.015] py-3 pl-4 pr-3.5"
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
                    <div className="flex items-center justify-between gap-3">
                      <MonoLabel className="text-white/45">{match.roundName}</MonoLabel>
                      <StatusPill accent={match.result === "won" ? "green" : match.result === "lost" ? "red" : "slate"}>
                        {match.result === "won" ? "Won" : match.result === "lost" ? "Lost" : "To play"}
                      </StatusPill>
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-[13px]">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-white">You</p>
                        <p className="tabular-nums text-white/55">
                          {match.myPayout != null ? money(match.myPayout) : "—"}{" "}
                          <span className="font-semibold" style={{ color: match.myMulti != null ? multiColor(match.myMulti) : undefined }}>
                            {multi(match.myMulti)}
                          </span>
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-white/25">VS</span>
                      <div className="min-w-0 text-right">
                        <p className="truncate font-semibold text-white/80">{match.opponent?.username ?? "To be decided"}</p>
                        <p className="tabular-nums text-white/55">
                          {match.theirPayout != null ? money(match.theirPayout) : "—"}{" "}
                          <span className="font-semibold" style={{ color: match.theirMulti != null ? multiColor(match.theirMulti) : undefined }}>
                            {multi(match.theirMulti)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <Link
          href={`/tournaments/${result.tournamentId}`}
          className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 transition hover:text-white"
        >
          Open the full bracket
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </>
  )
}
