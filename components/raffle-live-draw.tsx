"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Clock, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { AutoHeight } from "@/components/auto-height"
import { RaffleDrawReel, weightedNames } from "@/components/raffle-draw-spinner"

/**
 * The draw, on the raffle's own page.
 *
 * The spinner only ran in the admin before, so the people actually waiting on
 * the result saw a page that simply changed the next time they refreshed.
 *
 * Animates only when the winner arrives *while this page is open*. Opening a
 * raffle that was drawn last week shows the result straight away — a spinner
 * replaying an old draw would suggest it is happening now.
 */

type Entry = { username: string; tickets_purchased: number }

/** What the poll comes back with. Null winner means it has not been drawn. */
export type DrawStatus = { winner_username: string | null; winner_ticket_number: number | null }

const POLL_MS = 4000

/** The same gold the bonus list uses for a 500x: the colour of a big win. */
const WIN = "#F5C542"

/** How each stage arrives and leaves. Short enough not to feel like waiting. */
const ENTER = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
}



async function readStatus(raffleId: string): Promise<DrawStatus | null> {
  const { data } = await createClient()
    .from("raffles")
    .select("winner_username, winner_ticket_number")
    .eq("id", raffleId)
    .maybeSingle()
  return (data as DrawStatus) ?? null
}

export function RaffleLiveDraw({
  raffleId,
  endsAt,
  initialWinner,
  initialTicketNumber,
  entries,
  pollStatus = readStatus,
}: {
  raffleId: string
  endsAt: string
  initialWinner: string | null
  initialTicketNumber: number | null
  entries: Entry[]
  /** Swappable so the waiting-to-rolling handover can be exercised directly. */
  pollStatus?: (raffleId: string) => Promise<DrawStatus | null>
}) {
  const [winner, setWinner] = useState<string | null>(initialWinner)
  const [ticketNumber, setTicketNumber] = useState<number | null>(initialTicketNumber)
  // Only true for a draw this page witnessed, which is what gates the spinner.
  const [rolling, setRolling] = useState(false)
  const [closed, setClosed] = useState(() => Date.parse(endsAt) <= Date.now())

  const names = useRef<string[]>([])
  if (names.current.length === 0 && entries.length > 0) names.current = weightedNames(entries)

  const alreadyDrawn = useRef(!!initialWinner)

  const check = useCallback(async () => {
    if (alreadyDrawn.current) return
    const status = await pollStatus(raffleId)
    if (!status?.winner_username) return

    alreadyDrawn.current = true
    setTicketNumber(Number(status.winner_ticket_number) || null)
    // The spinner needs the name to land on, but the card must not appear until
    // it has: the winner is handed to the wheel, not to the page.
    setRolling(true)
    setWinner(status.winner_username)
  }, [raffleId, pollStatus])

  // Nudges the draw at the closing second, then watches for the result. Both
  // stop once there is a winner, so a finished raffle costs nothing.
  useEffect(() => {
    if (alreadyDrawn.current) return

    const sweep = () =>
      fetch("/api/raffles/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due: true }),
      }).catch(() => {
        // The database cron and the daily one are behind this.
      })

    const waitFor = Date.parse(endsAt) - Date.now()
    let closeTimer: ReturnType<typeof setTimeout> | undefined

    if (Number.isFinite(waitFor) && waitFor > 0 && waitFor < 2_000_000_000) {
      closeTimer = setTimeout(() => {
        setClosed(true)
        sweep()
      }, waitFor + 1500)
    } else {
      // Already closed when the page opened.
      sweep()
    }

    check()
    const poll = setInterval(() => {
      if (alreadyDrawn.current) return
      check()
    }, POLL_MS)

    return () => {
      if (closeTimer) clearTimeout(closeTimer)
      clearInterval(poll)
    }
  }, [endsAt, check])

  // One stage at a time, handed over rather than swapped: mode="wait" lets the
  // outgoing stage finish leaving before the next arrives, and the layout
  // wrapper eases the height between a one-line notice and the reel instead of
  // snapping the page around it.
  const stage = rolling && winner ? "rolling" : winner ? "winner" : closed ? "waiting" : null

  return (
    <AutoHeight>
      <AnimatePresence mode="wait" initial={false}>
        {stage === "rolling" && (
          <motion.div key="rolling" {...ENTER}>
            <div className="rounded-xl border border-white/[0.10] bg-[#0E0E12] p-4 sm:p-5">
              <RaffleDrawReel
                pool={names.current}
                winner={winner!}
                onDone={() => setTimeout(() => setRolling(false), 3500)}
              />
            </div>
          </motion.div>
        )}

        {stage === "winner" && (
          <motion.div key="winner" {...ENTER}>
            <div
              className="relative flex items-center gap-5 overflow-hidden rounded-xl border p-5 sm:p-6"
              style={{ borderColor: `${WIN}55`, background: `radial-gradient(600px 220px at 0% 0%, ${WIN}24, transparent 70%), #0E0E12` }}
            >
              <motion.span
                // A small flourish as the card takes over from the reel.
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${WIN}1f`, border: `1px solid ${WIN}55` }}
              >
                <Trophy className="h-7 w-7" style={{ color: WIN }} />
              </motion.span>
              <div className="min-w-0">
                <MonoLabel className="block" style={{ color: WIN }}>Winner</MonoLabel>
                <p className="mt-1.5 truncate text-[clamp(22px,3vw,30px)] font-black leading-none text-white">{winner}</p>
              </div>
              {ticketNumber != null && (
                <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-[11px] tabular-nums text-white/60">
                  Ticket #{ticketNumber}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Closed, no winner yet: say so rather than looking stuck. */}
        {stage === "waiting" && (
          <motion.div key="waiting" {...ENTER}>
            <div className="flex items-center gap-4 rounded-xl border border-white/[0.10] bg-[#0E0E12] p-5">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${ACCENTS.blue}1a` }}
              >
                <Clock className="h-5 w-5 animate-pulse" style={{ color: ACCENTS.blue }} />
              </span>
              <div>
                <MonoLabel className="block" style={{ color: ACCENTS.blue }}>Entries closed</MonoLabel>
                <p className="mt-1 text-[15px] font-semibold text-white/80">
                  {entries.length > 0 ? "Drawing the winner…" : "Nobody entered this one."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AutoHeight>
  )
}
