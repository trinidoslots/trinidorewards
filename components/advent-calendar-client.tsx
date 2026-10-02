"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { MODAL_BACKDROP } from "@/lib/modal-backdrop"
import { Check, Gift, Loader2, Lock, X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { LiveDot } from "@/components/landing/parts"
import { LoginModal } from "@/components/login-modal"
import { PageBody, PageHero } from "@/components/page-hero"
import { countdownTo } from "@/lib/schedule-week"
import { DOORS, doorState, nextOpening, utcDay, type AdventClaim, type AdventReward, type DoorState } from "@/lib/advent"

/**
 * The calendar: header, 24 doors, and the door you open.
 *
 * The calendar runs on GMT for everyone (lib/advent.ts). The date is still
 * read in the browser, after it mounts, so the countdown ticks and the page
 * does not render one moment on the server and hydrate at another; until
 * then the doors show as closed, which outside December is what they are.
 */

const RED = ACCENTS.red
const GREEN = ACCENTS.green
const GOLD = "#F5C542"
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

type Props = {
  rewardsByDay: Record<number, AdventReward[]>
  claims: AdventClaim[]
  userId: string | null
  username: string | null
  /** Pretend it is this date. For local previews only. */
  previewNow?: string
}

function useNow(previewNow?: string) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const read = () => setNow(previewNow ? new Date(previewNow) : new Date())
    read()
    const timer = setInterval(read, 1000)
    return () => clearInterval(timer)
  }, [previewNow])
  return now
}

const monthDay = (day: number) => `${day} December`

export function AdventCalendarClient({ rewardsByDay, claims, userId, previewNow }: Props) {
  const now = useNow(previewNow)
  const [claimed, setClaimed] = useState<Map<number, AdventClaim>>(() => new Map(claims.map((c) => [c.day_number, c])))
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  const opening = now ? nextOpening(now) : null
  const inSeason = now ? utcDay(now).month === 11 : false
  const today = now ? utcDay(now).day : 0
  const countdown = opening && now ? countdownTo(opening.toISOString(), now.getTime()) : undefined

  const note = !now
    ? "1 to 24 December"
    : inSeason && today <= DOORS
      ? `Door ${today} is open`
      : inSeason
        ? "That's a wrap for this year"
        : "Opens 1 December"

  const stateOf = (day: number): DoorState => (now ? doorState(day, claimed.has(day), now) : "locked")

  return (
    <>
      <PageHero
        accent="red"
        note={note}
        title="Advent Calendar"
        subtitle="A door a day from 1 to 24 December. Open today's to win one of the rewards behind it."
        figure={userId ? `${claimed.size}/${DOORS}` : undefined}
        figureLabel="Doors you opened"
        countdown={countdown && !countdown.over ? countdown : undefined}
        countdownLabel={inSeason ? "Next door in" : "Opens in"}
      />
      <PageBody>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: DOORS }, (_, index) => index + 1).map((day) => (
            <Door
              key={day}
              day={day}
              state={stateOf(day)}
              claim={claimed.get(day)}
              ready={now !== null}
              onOpen={() => setOpenDay(day)}
            />
          ))}
        </div>

        <p className="mt-10 text-center text-[12px] text-white/35">
          A new door opens every day at 00:00 GMT. Terms may apply. 18+ only.
        </p>
      </PageBody>

      <DoorDialog
        day={openDay}
        state={openDay ? stateOf(openDay) : "locked"}
        rewards={openDay ? (rewardsByDay[openDay] ?? []) : []}
        claim={openDay ? claimed.get(openDay) : undefined}
        signedIn={!!userId}
        onClose={() => setOpenDay(null)}
        onLogin={() => setLoginOpen(true)}
        onClaimed={(claim) => setClaimed((current) => new Map(current).set(claim.day_number, claim))}
      />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                                    Door                                    */
/* -------------------------------------------------------------------------- */

function Door({
  day,
  state,
  claim,
  ready,
  onOpen,
}: {
  day: number
  state: DoorState
  claim?: AdventClaim
  ready: boolean
  onOpen: () => void
}) {
  const finale = day === DOORS
  const tone =
    state === "today" ? RED : state === "claimed" ? GREEN : finale ? GOLD : "rgba(255,255,255,0.9)"
  // Locked doors are not buttons: there is nothing to do with one yet.
  const clickable = ready && state !== "locked"

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!clickable}
      title={state === "locked" ? `Opens ${monthDay(day)}` : undefined}
      className={`group relative aspect-square overflow-hidden rounded-xl border p-3 text-left transition duration-300 ${
        clickable ? "hover:-translate-y-1" : "cursor-default"
      } ${state === "missed" ? "opacity-50" : ""}`}
      style={{
        backgroundColor: state === "claimed" ? `${GREEN}10` : "#0E0E12",
        borderColor:
          state === "today" ? `${RED}88` : state === "claimed" ? `${GREEN}44` : finale ? `${GOLD}44` : "rgba(255,255,255,0.08)",
        boxShadow: state === "today" ? `0 0 0 1px ${RED}33, 0 24px 60px -24px ${RED}` : undefined,
      }}
    >
      {/* Gift ribbon across the closed doors; gone once one is opened. */}
      {state !== "claimed" && state !== "missed" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[62%] w-[10%]"
            style={{ backgroundColor: state === "today" ? `${RED}33` : finale ? `${GOLD}14` : "rgba(255,255,255,0.03)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[38%] h-[10%]"
            style={{ backgroundColor: state === "today" ? `${RED}33` : finale ? `${GOLD}14` : "rgba(255,255,255,0.03)" }}
          />
        </>
      )}

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <MonoLabel style={{ color: state === "today" ? RED : "rgba(255,255,255,0.35)" }}>Dec</MonoLabel>
          {state === "today" ? (
            <LiveDot color={RED} size={8} />
          ) : state === "claimed" ? (
            <Check className="h-4 w-4" style={{ color: GREEN }} />
          ) : state === "locked" ? (
            <Lock className="h-3.5 w-3.5 text-white/25" />
          ) : null}
        </div>

        {state === "claimed" ? (
          <div className="min-w-0">
            <span className="block text-[clamp(22px,4vw,30px)] leading-none">{claim?.reward_icon || "🎁"}</span>
            <span className="mt-1.5 block truncate text-[11.5px] font-semibold text-white/80">{claim?.reward_title || "Opened"}</span>
          </div>
        ) : (
          <div>
            <span
              className="block text-[clamp(30px,5vw,46px)] font-black leading-none tabular-nums tracking-[-0.03em]"
              style={{ color: state === "locked" && !finale ? "rgba(255,255,255,0.3)" : tone }}
            >
              {day}
            </span>
            {state === "today" && (
              <span className="mt-1.5 block text-[11.5px] font-bold uppercase tracking-[0.08em]" style={{ color: RED }}>
                Open now
              </span>
            )}
            {state === "missed" && <span className="mt-1.5 block text-[11.5px] font-semibold text-white/50">Missed</span>}
          </div>
        )}
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Door dialog                                */
/* -------------------------------------------------------------------------- */

/**
 * What is behind a door, and opening it.
 *
 * The server picks the reward (/api/advent/claim); the reel only lands on what
 * it picked. It runs a fixed number of steps that slow down towards the end,
 * worked out before it starts — the old roll changed its own speed mid-run and
 * restarted its count each time, so it could keep going and never land.
 */
function DoorDialog({
  day,
  state,
  rewards,
  claim,
  signedIn,
  onClose,
  onLogin,
  onClaimed,
}: {
  day: number | null
  state: DoorState
  rewards: AdventReward[]
  claim?: AdventClaim
  signedIn: boolean
  onClose: () => void
  onLogin: () => void
  onClaimed: (claim: AdventClaim) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reel, setReel] = useState<{ index: number; done: boolean; won: AdventReward } | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => setMounted(true), [])

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = []
  }, [])

  // Through a ref: the page re-renders every second for its clock and hands
  // down a new onClose each time. As a dependency below, that reset the
  // dialog every second — and wiped the reel mid-roll.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // A different door (or none): start clean.
  useEffect(() => {
    setError(null)
    setReel(null)
    setBusy(false)
    clearTimers()
    if (day === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [day, clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  const sorted = [...rewards].sort((a, b) => Number(b.probability) - Number(a.probability))

  function spin(won: AdventReward) {
    const list = sorted.length > 0 ? sorted : [won]
    const target = Math.max(0, list.findIndex((reward) => reward.id === won.id))
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const steps = reduced || list.length === 1 ? 1 : 22 + list.length
    const start = (((target - (steps - 1)) % list.length) + list.length) % list.length

    let at = 0
    for (let step = 0; step < steps; step++) {
      // 55ms at the start, slowing to about 420ms on the last steps.
      at += 55 + 365 * Math.pow(step / Math.max(1, steps - 1), 3)
      const index = (start + step) % list.length
      const last = step === steps - 1
      timers.current.push(
        window.setTimeout(() => {
          setReel({ index, done: last, won: list[index] })
        }, at),
      )
    }
    setReel({ index: start, done: false, won: list[start] })
  }

  async function open() {
    if (!day) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/advent/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_number: day }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload?.error || "Could not open the door.")
        return
      }
      const won = (sorted.find((reward) => reward.id === payload.reward?.id) ?? payload.reward) as AdventReward
      // Recorded now, not when the reel lands: the server has already saved
      // it, and closing mid-roll must not leave the door looking unopened.
      onClaimed({
        day_number: day,
        claimed_at: new Date().toISOString(),
        reward_title: won.title,
        reward_icon: won.icon,
        reward_value: won.reward_value,
      })
      spin(won)
    } catch {
      setError("Could not reach the site. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  const shown = reel ? (sorted.length > 0 ? sorted : [reel.won])[reel.index] ?? reel.won : null

  return createPortal(
    <AnimatePresence>
      {day !== null && (
        <motion.div
          key="door"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          {...MODAL_BACKDROP}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !(reel && !reel.done)) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Door ${day}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="w-full max-w-md overflow-hidden rounded-xl border border-white/[0.10] bg-[#0E0E12] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
          >
            <div className="relative overflow-hidden border-b border-white/[0.07] px-6 pb-5 pt-6">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(380px 200px at 85% -30%, ${RED}26, transparent 65%)` }}
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                disabled={!!reel && !reel.done}
                className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-0"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative">
                <div className="flex items-center gap-2.5">
                  <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: RED }} />
                  <MonoLabel style={{ color: RED }}>{monthDay(day)}</MonoLabel>
                </div>
                <p className="mt-3 text-[30px] font-black uppercase leading-none tracking-[-0.01em] text-white">Door {day}</p>
              </div>
            </div>

            <div className="px-6 py-6">
              {reel && shown ? (
                <Reel reward={shown} done={reel.done} onClose={onClose} />
              ) : state === "claimed" && claim ? (
                <Won icon={claim.reward_icon} title={claim.reward_title} value={claim.reward_value} note="You opened this door." />
              ) : (
                <>
                  {sorted.length === 0 ? (
                    <p className="text-[14px] text-white/50">Nothing is behind this door yet.</p>
                  ) : (
                    <>
                      <MonoLabel className="block text-white/45">
                        {sorted.length === 1 ? "Behind this door" : `One of ${sorted.length} rewards`}
                      </MonoLabel>
                      <ul className="mt-3 space-y-2">
                        {sorted.map((reward) => (
                          <li key={reward.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="text-[22px] leading-none">{reward.icon || "🎁"}</span>
                              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{reward.title}</span>
                              {sorted.length > 1 && (
                                <span className="shrink-0 text-[13px] font-bold tabular-nums text-white/70">
                                  {Number(reward.probability)}%
                                </span>
                              )}
                            </div>
                            {sorted.length > 1 && (
                              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.min(100, Number(reward.probability))}%`, backgroundColor: RED }}
                                />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {error && (
                    <p className="mt-4 text-[13px]" style={{ color: RED }}>
                      {error}
                    </p>
                  )}

                  <div className="mt-5">
                    {state === "today" && sorted.length > 0 ? (
                      signedIn ? (
                        <PrimaryButton onClick={open} disabled={busy}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                          Open the door
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton onClick={onLogin}>Log in to open it</PrimaryButton>
                      )
                    ) : state === "missed" ? (
                      <p className="text-[13.5px] text-white/50">This door closed at the end of {monthDay(day)}.</p>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-bold text-black transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
      style={{ backgroundColor: RED, boxShadow: `0 12px 36px -14px ${RED}` }}
    >
      {children}
    </button>
  )
}

function Reel({ reward, done, onClose }: { reward: AdventReward; done: boolean; onClose: () => void }) {
  return (
    <div className="text-center">
      <div
        className="relative mx-auto flex h-36 items-center justify-center overflow-hidden rounded-xl border"
        style={{
          borderColor: done ? `${GREEN}66` : "rgba(255,255,255,0.10)",
          backgroundColor: done ? `${GREEN}12` : "rgba(255,255,255,0.02)",
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${reward.id}-${done}`}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: done ? 0.35 : 0.09, ease: EASE }}
            className="px-4"
          >
            <span className="block text-[46px] leading-none">{reward.icon || "🎁"}</span>
            <span className="mt-2 block truncate text-[16px] font-bold text-white">{reward.title}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <p className="mt-5 text-[20px] font-black uppercase" style={{ color: GREEN }}>
              You won
            </p>
            {reward.reward_value && reward.reward_value !== reward.title && (
              <p className="mt-1 text-[14px] text-white/60">{reward.reward_value}</p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex h-11 items-center rounded-md border border-white/15 bg-white/[0.04] px-6 text-[14px] font-semibold text-white transition hover:border-white/30"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {!done && <p className="mt-4 text-[13px] text-white/45">Opening…</p>}
    </div>
  )
}

function Won({ icon, title, value, note }: { icon?: string | null; title?: string | null; value?: string | null; note: string }) {
  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-36 flex-col items-center justify-center rounded-xl border"
        style={{ borderColor: `${GREEN}55`, backgroundColor: `${GREEN}10` }}
      >
        <span className="text-[46px] leading-none">{icon || "🎁"}</span>
        <span className="mt-2 text-[16px] font-bold text-white">{title || "Reward"}</span>
      </div>
      {value && value !== title && <p className="mt-4 text-[14px] text-white/60">{value}</p>}
      <p className="mt-2 text-[13px] text-white/45">{note}</p>
    </div>
  )
}
