"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, Clock, Gamepad2, Loader2, Search, Target, Trophy, X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { SelectMenu } from "@/components/ui/select-menu"
import { LoginModal } from "@/components/login-modal"
import { LiveDot } from "@/components/landing/parts"
import { multiColor } from "@/components/hunt-kpi-board"
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
/** The page's accent, as the landing index gives it: a target is red. */
const RED = ACCENTS.red

const TABS: { id: Phase; label: string; empty: string; note: string }[] = [
  { id: "active", label: "Live", empty: "No live challenges right now", note: "New challenges show up here as soon as they are set." },
  { id: "upcoming", label: "Upcoming", empty: "Nothing lined up yet", note: "Challenges show up here before they start." },
  { id: "completed", label: "Completed", empty: "No finished challenges yet", note: "Finished challenges and their winners land here." },
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

/** The dialog and toolbar fields, at the page's 40–44px control size. */
const INPUT =
  "w-full rounded-md border border-white/[0.10] bg-black/40 text-white outline-none transition placeholder:text-white/30 hover:border-white/20 focus:border-white/30"
const SELECT = "h-10! px-3.5! text-[13px]!"

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

/** A multiplier target in the hunt board's colours; a dollar target in white. */
function targetColor(challenge: Pick<Challenge, "target_type" | "target_value">) {
  return challenge.target_type === "multiplier" ? multiColor(Number(challenge.target_value)) : "#FFFFFF"
}

/* -------------------------------------------------------------------------- */
/*                               Header pieces                                */
/* -------------------------------------------------------------------------- */

const STEPS = [
  { title: "Play the slot", copy: "At the minimum bet or above, on Stake." },
  { title: "Hit the target", copy: "The multiplier or the win the card asks for." },
  { title: "Claim it", copy: "Send the bet ID. It is checked before it counts." },
]

/** Three short steps under the title, like the store's. */
export function ChallengeSteps() {
  return (
    <ol className="mt-8 grid max-w-2xl grid-cols-3 gap-x-4 sm:gap-x-6">
      {STEPS.map((step, index) => (
        <li key={step.title} className="border-t border-white/[0.10] pt-3">
          <MonoLabel style={{ color: RED }}>0{index + 1}</MonoLabel>
          <p className="mt-1.5 text-[13px] font-semibold leading-snug text-white sm:text-[14px]">{step.title}</p>
          <p className="mt-1 hidden text-[12.5px] leading-relaxed text-white/45 sm:block">{step.copy}</p>
        </li>
      ))}
    </ol>
  )
}

/**
 * The header panel: how many are live, what they pay, how many have been won.
 *
 * Cash and points are kept apart rather than added together — "$150 + 2,000
 * points" is a true sentence, "$2,150" is not.
 */
export function ChallengeSummary({ challenges }: { challenges: BoardChallenge[] }) {
  const live = challenges.filter((challenge) => challenge.phase === "active")
  const cash = live.filter((c) => c.prize_type === "cash").reduce((sum, c) => sum + c.prize_amount, 0)
  const points = live.filter((c) => c.prize_type === "points").reduce((sum, c) => sum + c.prize_amount, 0)
  const won = challenges.reduce((sum, challenge) => sum + challenge.winners.length, 0)

  const offer =
    cash > 0 && points > 0
      ? `$${cash.toLocaleString("en-US")} + ${Math.round(points).toLocaleString("en-US")} pts`
      : cash > 0
        ? `$${cash.toLocaleString("en-US")}`
        : points > 0
          ? `${Math.round(points).toLocaleString("en-US")} pts`
          : "—"

  return (
    <div>
      <div className="flex items-center gap-2">
        {live.length > 0 && <LiveDot color={ACCENTS.green} size={7} />}
        <MonoLabel style={{ color: live.length > 0 ? ACCENTS.green : RED }}>
          {live.length > 0 ? "Live now" : "Nothing live"}
        </MonoLabel>
      </div>
      <p className="mt-3 flex items-baseline gap-2 leading-none">
        <span className="text-[clamp(40px,5vw,56px)] font-black tabular-nums tracking-[-0.02em] text-white">{live.length}</span>
        <span className="text-[15px] font-semibold text-white/45">{live.length === 1 ? "challenge" : "challenges"}</span>
      </p>
      <dl className="mt-6 grid grid-cols-2 divide-x divide-white/[0.07] border-t border-white/[0.07] pt-5">
        <div className="pr-4">
          <dt>
            <MonoLabel className="text-white/45">Up for grabs</MonoLabel>
          </dt>
          <dd className="mt-1.5 truncate text-[18px] font-bold tabular-nums" style={{ color: cash + points > 0 ? ACCENTS.green : "rgba(255,255,255,0.4)" }}>
            {offer}
          </dd>
        </div>
        <div className="pl-4">
          <dt>
            <MonoLabel className="text-white/45">Claims won</MonoLabel>
          </dt>
          <dd className="mt-1.5 text-[18px] font-bold tabular-nums text-white">{won.toLocaleString("en-US")}</dd>
        </div>
      </dl>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                    Board                                   */
/* -------------------------------------------------------------------------- */

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

  const current = TABS.find((entry) => entry.id === tab)!
  const filtered = query.trim() !== "" || minBet !== "any"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* The three phases, with the fill sliding to the picked one. */}
        <div className="inline-flex gap-1 self-start rounded-full border border-white/[0.10] bg-black/40 p-1">
          {TABS.map(({ id, label }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-200"
                style={{ color: active ? "#000" : "rgba(255,255,255,0.55)" }}
              >
                {active && (
                  <motion.span
                    layoutId="challenge-tab"
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: RED }}
                    transition={{ duration: 0.28, ease: EASE }}
                  />
                )}
                <span className="relative">{label}</span>
                <span className="relative tabular-nums" style={{ opacity: active ? 0.6 : 0.5 }}>
                  {counts[id]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_11.5rem_11.5rem] lg:w-[40rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              aria-label="Search slots"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search slots…"
              className={`${INPUT} h-10 pl-10 pr-3 text-[14px]`}
            />
          </div>
          <SelectMenu className={SELECT} aria-label="Minimum bet" value={minBet} onChange={setMinBet} options={MIN_BETS} />
          <SelectMenu className={SELECT} aria-label="Order" value={order} onChange={setOrder} options={ORDERS} />
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {shown.length === 0 ? (
          <motion.div
            key={`empty-${tab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex items-center gap-4 rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
              style={{ borderColor: `${RED}44`, backgroundColor: `${RED}14` }}
            >
              <Target className="h-5 w-5" style={{ color: RED }} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-white">{filtered ? "No challenges match" : current.empty}</p>
              <p className="mt-0.5 text-[13px] text-white/45">
                {filtered ? "Try another slot name or a higher min bet." : current.note}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key={`grid-${tab}`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((challenge, index) => (
                <motion.div
                  key={challenge.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
                  className="grid"
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

/* -------------------------------------------------------------------------- */
/*                                    Card                                    */
/* -------------------------------------------------------------------------- */

/**
 * The slot's artwork over a blurred, darkened copy of itself.
 *
 * Slot thumbnails come in every shape from every provider. Shown whole on a
 * blur of their own colours, a portrait thumb and a square one both fill the
 * band without being cropped or sitting in an empty grey box.
 */
function SlotArt({ src, className = "h-40" }: { src: string | null; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#0A0A0C] ${className}`}>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- slot artwork from the catalogue */}
          <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0E0E12] via-[#0E0E12]/40 to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element -- slot artwork from the catalogue */}
          <img
            src={src}
            alt=""
            loading="lazy"
            className="relative mx-auto h-full w-auto max-w-[70%] rounded-lg object-contain py-4 drop-shadow-[0_16px_30px_rgba(0,0,0,0.6)]"
          />
        </>
      ) : (
        <div
          className="flex h-full items-center justify-center"
          style={{ background: `radial-gradient(260px 140px at 50% 0%, ${RED}1f, transparent 70%)` }}
        >
          <Gamepad2 className="h-10 w-10 text-white/15" />
        </div>
      )}
    </div>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] backdrop-blur"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}26`, color }}
    >
      {children}
    </span>
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
  const slots = challenge.max_winners
  const won = challenge.winners.length

  // What the button says: the viewer's own claim first, then the phase.
  let button: { label: string; enabled: boolean; icon?: React.ReactNode; color?: string }
  if (status === "approved") button = { label: "You won", enabled: false, icon: <Trophy className="h-4 w-4" />, color: ACCENTS.green }
  else if (status === "pending") button = { label: "Claim pending", enabled: false, icon: <Clock className="h-4 w-4" />, color: ACCENTS.amber }
  else if (active) button = { label: status === "rejected" ? "Claim again" : "Claim", enabled: true, icon: <Target className="h-4 w-4" /> }
  else if (challenge.phase === "upcoming") button = { label: "Not started yet", enabled: false }
  else button = { label: "Ended", enabled: false }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12] transition duration-300 hover:-translate-y-1 hover:border-white/20">
      <div className="relative">
        <SlotArt src={challenge.image_url} />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {challenge.phase === "active" ? (
            <Chip color={ACCENTS.green}>
              <LiveDot color={ACCENTS.green} size={6} /> Live
            </Chip>
          ) : challenge.phase === "upcoming" ? (
            <Chip color={ACCENTS.blue}>Upcoming</Chip>
          ) : (
            <Chip color={ACCENTS.slate}>Completed</Chip>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-white/80 backdrop-blur">
            <Clock className="h-3 w-3" />
            {timing(challenge, now)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-bold text-white">{challenge.slot_name}</h3>
          {challenge.provider && <p className="mt-0.5 truncate text-[12.5px] text-white/40">{challenge.provider}</p>}
        </div>

        <div>
          <MonoLabel className="text-white/45">{challenge.target_type === "payout" ? "Win at least" : "Hit at least"}</MonoLabel>
          <p
            className="mt-1 text-[36px] font-black leading-none tabular-nums tracking-[-0.02em]"
            style={{ color: targetColor(challenge) }}
          >
            {targetLabel(challenge)}
          </p>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-white/[0.07] rounded-lg border border-white/[0.07]">
          <div className="px-3.5 py-2.5">
            <dt>
              <MonoLabel className="text-white/40">Prize</MonoLabel>
            </dt>
            <dd className="mt-1 truncate text-[16px] font-bold tabular-nums" style={{ color: ACCENTS.green }}>
              {prizeLabel(challenge)}
            </dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt>
              <MonoLabel className="text-white/40">Min bet</MonoLabel>
            </dt>
            <dd className="mt-1 truncate text-[16px] font-bold tabular-nums text-white">{minBetLabel(challenge.min_bet)}</dd>
          </div>
        </dl>

        {/* Winner slots: filled ones in green, so "2 of 3 gone" is seen, not read. */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <MonoLabel className="text-white/40">Winners</MonoLabel>
            <span className="text-[12.5px] font-semibold tabular-nums text-white/70">
              {slots !== null ? `${won} of ${slots}` : won > 0 ? `${won}, no limit` : "No limit"}
            </span>
          </div>
          {slots !== null && slots > 0 && slots <= 20 && (
            <div className="mt-2 flex gap-1">
              {Array.from({ length: slots }, (_, index) => (
                <span
                  key={index}
                  className="h-1.5 flex-1 rounded-full"
                  style={{ backgroundColor: index < won ? ACCENTS.green : "rgba(255,255,255,0.08)" }}
                />
              ))}
            </div>
          )}
          {won > 0 && (
            <p className="mt-2 truncate text-[12.5px] text-white/50">
              <Trophy className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" style={{ color: ACCENTS.amber }} />
              {challenge.winners.join(", ")}
            </p>
          )}
        </div>

        {challenge.notes && <p className="line-clamp-2 text-[12.5px] leading-relaxed text-white/40">{challenge.notes}</p>}

        <button
          type="button"
          onClick={onClaim}
          disabled={!button.enabled}
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md text-[14px] font-bold transition hover:brightness-110 active:scale-[0.99] disabled:cursor-default disabled:hover:brightness-100 disabled:active:scale-100"
          style={
            button.enabled
              ? { backgroundColor: RED, color: "#000", boxShadow: `0 10px 30px -14px ${RED}` }
              : {
                  border: `1px solid ${button.color ? `${button.color}55` : "rgba(255,255,255,0.10)"}`,
                  backgroundColor: button.color ? `${button.color}14` : "rgba(255,255,255,0.03)",
                  color: button.color ?? "rgba(255,255,255,0.4)",
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

/* -------------------------------------------------------------------------- */
/*                                Claim dialog                                */
/* -------------------------------------------------------------------------- */

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
            role="dialog"
            aria-modal="true"
            aria-label={`Claim ${challenge.slot_name}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="w-full max-w-md overflow-hidden rounded-xl border border-white/[0.10] bg-[#0E0E12] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
          >
            <div className="relative">
              <SlotArt src={challenge.image_url} className="h-32" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 rounded-md bg-black/50 p-1.5 text-white/60 backdrop-blur transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-2 pt-1">
              <MonoLabel style={{ color: RED }}>Claim challenge</MonoLabel>
              <p className="mt-2 truncate text-[20px] font-bold text-white">{challenge.slot_name}</p>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="flex flex-col items-center gap-2 px-6 pb-7 pt-4 text-center"
                >
                  <CheckCircle2 className="h-10 w-10" style={{ color: ACCENTS.green }} />
                  <p className="mt-1 text-[17px] font-bold text-white">Claim sent</p>
                  <p className="text-[13.5px] leading-relaxed text-white/50">
                    The bet is checked before it counts. You will see the result on this card.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 inline-flex h-11 items-center rounded-md border border-white/15 bg-white/[0.04] px-6 text-[14px] font-semibold text-white transition hover:border-white/30"
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
                  className="space-y-4 px-6 pb-6 pt-3"
                >
                  <dl className="grid grid-cols-3 divide-x divide-white/[0.07] rounded-lg border border-white/[0.07]">
                    {[
                      { label: "Target", value: targetLabel(challenge), color: targetColor(challenge) },
                      { label: "Min bet", value: minBetLabel(challenge.min_bet), color: "#FFFFFF" },
                      { label: "Prize", value: prizeLabel(challenge), color: ACCENTS.green },
                    ].map((stat) => (
                      <div key={stat.label} className="px-3.5 py-3">
                        <dt>
                          <MonoLabel className="text-white/40">{stat.label}</MonoLabel>
                        </dt>
                        <dd className="mt-1 truncate text-[16px] font-bold tabular-nums" style={{ color: stat.color }}>
                          {stat.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <label className="block">
                    <MonoLabel className="mb-2 block text-white/45">Casino ID of the bet</MonoLabel>
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
                      className={`${INPUT} h-11 px-3.5 font-mono text-[14px]`}
                      style={formatProblem ? { borderColor: `${RED}88` } : undefined}
                    />
                  </label>
                  <p className="text-[13px] leading-relaxed text-white/50">
                    On Stake, open the winning bet and copy its ID. It starts with{" "}
                    <span className="font-mono text-white/80">casino:</span> followed by numbers.
                  </p>

                  <AnimatePresence>
                    {(formatProblem || error) && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden text-[13px]"
                        style={{ color: RED }}
                      >
                        {error ?? formatProblem}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={busy || !value.trim()}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-bold text-black transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
                    style={{ backgroundColor: RED, boxShadow: `0 12px 36px -14px ${RED}` }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
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
