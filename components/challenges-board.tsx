"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, Clock, Crosshair, Gamepad2, Loader2, Search, Target, Trophy, X } from "lucide-react"
import { ACCENTS, MonoLabel, Tag } from "@/components/ui/panel"
import { FIELD_CLASS, SelectMenu } from "@/components/ui/select-menu"
import { LoginModal } from "@/components/login-modal"
import {
  minBetLabel,
  prizeLabel,
  readCasinoId,
  targetLabel,
  type Challenge,
  type Phase,
  type SubmissionStatus,
} from "@/lib/challenges"

export type BoardChallenge = Challenge & {
  phase: Phase
  /** Approved claimers, in the order they were approved. */
  winners: string[]
  /** The signed-in viewer's latest claim on it, if any. */
  myStatus: SubmissionStatus | null
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const TABS: { id: Phase; label: string; empty: string }[] = [
  { id: "active", label: "Active", empty: "No live challenges right now" },
  { id: "upcoming", label: "Upcoming", empty: "Nothing lined up yet" },
  { id: "completed", label: "Completed", empty: "No finished challenges yet" },
]

const MIN_BETS = [
  { value: "any", label: "Any min bet" },
  { value: "0.2", label: "Min bet up to $0.20" },
  { value: "1", label: "Min bet up to $1" },
  { value: "5", label: "Min bet up to $5" },
  { value: "20", label: "Min bet up to $20" },
]

const ORDERS = [
  { value: "default", label: "Default order" },
  { value: "ending", label: "Ending soonest" },
  { value: "prize", label: "Biggest prize" },
  { value: "target", label: "Lowest target" },
  { value: "newest", label: "Newest" },
]

/** "2d 4h", "3h 12m", "8m". */
function span(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${rest}m`
  return `${rest}m`
}

function timing(challenge: BoardChallenge, now: number): string {
  if (challenge.phase === "upcoming") return `Starts in ${span(Date.parse(challenge.starts_at) - now)}`
  if (challenge.phase === "completed") {
    const at = challenge.ended_at ?? challenge.ends_at
    return at && Date.parse(at) <= now
      ? `Ended ${new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
      : "All winners in"
  }
  return challenge.ends_at ? `Ends in ${span(Date.parse(challenge.ends_at) - now)}` : "No end date"
}

export function ChallengesBoard({ challenges, signedIn }: { challenges: BoardChallenge[]; signedIn: boolean }) {
  const [tab, setTab] = useState<Phase>("active")
  const [query, setQuery] = useState("")
  const [minBet, setMinBet] = useState("any")
  const [order, setOrder] = useState("default")
  const [claiming, setClaiming] = useState<BoardChallenge | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  /** Claims made on this visit, so a card updates without a reload. */
  const [claimed, setClaimed] = useState<Record<string, SubmissionStatus>>({})
  const [now, setNow] = useState(() => Date.now())

  // The countdowns on the cards.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const counts = useMemo(() => {
    const result: Record<Phase, number> = { active: 0, upcoming: 0, completed: 0 }
    for (const challenge of challenges) result[challenge.phase]++
    return result
  }, [challenges])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const cap = minBet === "any" ? Infinity : Number(minBet)
    const list = challenges.filter(
      (challenge) =>
        challenge.phase === tab &&
        challenge.min_bet <= cap &&
        (!needle || `${challenge.slot_name} ${challenge.provider ?? ""}`.toLowerCase().includes(needle)),
    )
    const endOf = (challenge: BoardChallenge) => (challenge.ends_at ? Date.parse(challenge.ends_at) : Infinity)
    if (order === "ending") list.sort((a, b) => endOf(a) - endOf(b))
    if (order === "prize") list.sort((a, b) => b.prize_amount - a.prize_amount)
    if (order === "target") list.sort((a, b) => a.target_value - b.target_value)
    if (order === "newest") list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    return list
  }, [challenges, tab, query, minBet, order])

  const empty = TABS.find((entry) => entry.id === tab)!.empty

  return (
    <div className="space-y-4">
      {/* The three tabs, with the pill sliding to the picked one. */}
      <div className="flex justify-center">
        <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.022] p-1">
          {TABS.map(({ id, label }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="relative flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-200 sm:px-6"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.4)" }}
              >
                {active && (
                  <motion.span
                    layoutId="challenge-tab"
                    className="absolute inset-0 rounded-lg border"
                    style={{ borderColor: `${ACCENTS.purple}66`, backgroundColor: `${ACCENTS.purple}1f` }}
                    transition={{ duration: 0.28, ease: EASE }}
                  />
                )}
                <span className="relative">{label}</span>
                <span
                  className="relative rounded px-1.5 py-0.5 text-[10px] tabular-nums"
                  style={{
                    backgroundColor: active ? `${ACCENTS.purple}33` : "rgba(255,255,255,0.06)",
                    color: active ? ACCENTS.purple : "rgba(255,255,255,0.4)",
                  }}
                >
                  {counts[id]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            aria-label="Search slots"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search slots"
            className={`${FIELD_CLASS} h-10 pl-10`}
          />
        </div>
        <SelectMenu aria-label="Minimum bet" value={minBet} onChange={setMinBet} options={MIN_BETS} />
        <SelectMenu aria-label="Order" value={order} onChange={setOrder} options={ORDERS} />
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {shown.length === 0 ? (
          <motion.div
            key={`empty-${tab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] py-20"
          >
            <Target className="h-7 w-7" style={{ color: ACCENTS.purple }} />
            <p className="text-[16px] font-semibold text-white">
              {query || minBet !== "any" ? "No challenges match" : empty}
            </p>
          </motion.div>
        ) : (
          <motion.div key={`grid-${tab}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((challenge, index) => (
                <motion.div
                  key={challenge.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
                >
                  <ChallengeCard
                    challenge={challenge}
                    status={claimed[challenge.id] ?? challenge.myStatus}
                    now={now}
                    onClaim={() => (signedIn ? setClaiming(challenge) : setLoginOpen(true))}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <ClaimDialog
        challenge={claiming}
        onClose={() => setClaiming(null)}
        onClaimed={(id) => setClaimed((current) => ({ ...current, [id]: "pending" }))}
      />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}

function ChallengeCard({
  challenge,
  status,
  now,
  onClaim,
}: {
  challenge: BoardChallenge
  status: SubmissionStatus | null
  now: number
  onClaim: () => void
}) {
  const active = challenge.phase === "active"
  const winnersText =
    challenge.max_winners !== null ? `${challenge.winners.length}/${challenge.max_winners}` : `${challenge.winners.length}`

  // What the button says: the viewer's own claim first, then the phase.
  let button: { label: string; enabled: boolean; icon?: React.ReactNode; color?: string }
  if (status === "approved") button = { label: "You won", enabled: false, icon: <Trophy className="h-3.5 w-3.5" />, color: ACCENTS.green }
  else if (status === "pending") button = { label: "Claim pending", enabled: false, icon: <Clock className="h-3.5 w-3.5" />, color: ACCENTS.amber }
  else if (active) button = { label: status === "rejected" ? "Claim again" : "Claim", enabled: true }
  else if (challenge.phase === "upcoming") button = { label: "Not started", enabled: false }
  else button = { label: "Ended", enabled: false }

  return (
    <div className="lift flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.022]">
      <div className="relative flex h-40 items-center justify-center bg-gradient-to-b from-white/[0.04] to-transparent">
        {challenge.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- slot artwork from the catalogue
          <img src={challenge.image_url} alt="" className="h-32 w-auto rounded-lg object-cover shadow-lg shadow-black/40" />
        ) : (
          <Gamepad2 className="h-10 w-10 text-white/10" />
        )}
        <div className="absolute left-3 top-3">
          {challenge.phase === "active" && <Tag accent="green">Live</Tag>}
          {challenge.phase === "upcoming" && <Tag accent="blue">Upcoming</Tag>}
          {challenge.phase === "completed" && <Tag accent="slate">Completed</Tag>}
        </div>
        <span className="absolute right-3 top-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/40">
          <Clock className="h-3 w-3" />
          {timing(challenge, now)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="truncate text-[15px] font-semibold text-white">{challenge.slot_name}</h3>
          {challenge.provider && <MonoLabel className="text-white/30">{challenge.provider}</MonoLabel>}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <Crosshair className="h-4 w-4 shrink-0" style={{ color: ACCENTS.purple }} />
          <div className="min-w-0">
            <MonoLabel className="block text-white/30">{challenge.target_type === "payout" ? "Win at least" : "Hit at least"}</MonoLabel>
            <p className="text-[20px] font-semibold leading-tight tabular-nums text-white">{targetLabel(challenge)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Min bet" value={minBetLabel(challenge.min_bet)} />
          <Stat label="Prize" value={prizeLabel(challenge)} color={ACCENTS.green} />
          <Stat label="Winners" value={winnersText} />
        </dl>

        {challenge.notes && <p className="line-clamp-2 text-[12px] text-white/35">{challenge.notes}</p>}

        {challenge.phase === "completed" && challenge.winners.length > 0 && (
          <p className="truncate text-[12px] text-white/45">
            <Trophy className="mr-1 inline h-3 w-3" style={{ color: ACCENTS.amber }} />
            {challenge.winners.join(", ")}
          </p>
        )}

        <button
          type="button"
          onClick={onClaim}
          disabled={!button.enabled}
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.12em] transition hover:brightness-110 disabled:cursor-default disabled:hover:brightness-100"
          style={
            button.enabled
              ? { backgroundColor: ACCENTS.purple, color: "#0B0B0D" }
              : {
                  border: `1px solid ${button.color ? `${button.color}55` : "rgba(255,255,255,0.08)"}`,
                  color: button.color ?? "rgba(255,255,255,0.3)",
                }
          }
        >
          {button.icon}
          {button.label}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-2">
      <dd className="truncate text-[13px] font-semibold tabular-nums" style={{ color: color ?? "#E7E7EA" }}>
        {value}
      </dd>
      <dt className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/30">{label}</dt>
    </div>
  )
}

/**
 * The claim: the bet id from Stake, as "casino:" and digits.
 *
 * Checked here as the viewer types, so a wrong paste is caught before it is
 * sent; the route checks it again, since this is only a convenience.
 */
function ClaimDialog({
  challenge,
  onClose,
  onClaimed,
}: {
  challenge: BoardChallenge | null
  onClose: () => void
  onClaimed: (challengeId: string) => void
}) {
  const [value, setValue] = useState("")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [mounted, setMounted] = useState(false)
  const open = challenge !== null

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setValue("")
    setTouched(false)
    setError(null)
    setDone(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const valid = readCasinoId(value) !== null
  const formatProblem = touched && value.trim() && !valid ? 'Must be "casino:" followed by numbers only.' : null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!challenge || !valid) {
      setError('Must be "casino:" followed by numbers only.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/challenges/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, casinoId: value.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.error ?? "Could not send your claim.")
        return
      }
      onClaimed(challenge.id)
      setDone(true)
    } catch {
      setError("Could not reach the site. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {challenge && (
        <motion.div
          key="claim"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="w-full max-w-md overflow-hidden rounded-xl border border-white/[0.10] bg-[#0E0E12] shadow-2xl shadow-black/60"
          >
            <header className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
              {challenge.image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- slot artwork from the catalogue
                <img src={challenge.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
              )}
              <div className="min-w-0">
                <MonoLabel className="text-white/40">Claim challenge</MonoLabel>
                <p className="truncate text-[14px] font-semibold text-white">
                  {challenge.slot_name} · {targetLabel(challenge)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto rounded p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="flex flex-col items-center gap-2 px-6 py-8 text-center"
                >
                  <CheckCircle2 className="h-9 w-9" style={{ color: ACCENTS.green }} />
                  <p className="text-[15px] font-semibold text-white">Claim sent</p>
                  <p className="text-[13px] text-white/45">
                    The bet is checked before it counts. You will see the result on this card.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 h-9 rounded-md border border-white/[0.10] px-5 text-[13px] text-white/70 transition hover:border-white/25 hover:text-white"
                  >
                    Done
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3 p-4"
                >
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Target" value={targetLabel(challenge)} />
                    <Stat label="Min bet" value={minBetLabel(challenge.min_bet)} />
                    <Stat label="Prize" value={prizeLabel(challenge)} color={ACCENTS.green} />
                  </div>

                  <label className="block">
                    <MonoLabel className="mb-1.5 block text-white/40">Casino ID of the bet</MonoLabel>
                    <input
                      value={value}
                      onChange={(event) => {
                        setValue(event.target.value)
                        setError(null)
                      }}
                      onBlur={() => setTouched(true)}
                      placeholder="casino:519440954076"
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                      className={`${FIELD_CLASS} h-10 font-mono`}
                      style={formatProblem ? { borderColor: `${ACCENTS.red}88` } : undefined}
                    />
                  </label>
                  <p className="text-[11.5px] leading-relaxed text-white/35">
                    On Stake, open the winning bet and copy its ID. It starts with <span className="font-mono text-white/60">casino:</span>{" "}
                    followed by numbers.
                  </p>

                  <AnimatePresence>
                    {(formatProblem || error) && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden text-[12.5px]"
                        style={{ color: ACCENTS.red }}
                      >
                        {error ?? formatProblem}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={busy || !value.trim()}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.12em] text-black transition hover:brightness-110 disabled:opacity-40"
                    style={{ backgroundColor: ACCENTS.purple }}
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Submit claim
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
