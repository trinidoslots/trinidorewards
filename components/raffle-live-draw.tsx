"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Clock, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
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

  if (rolling && winner) {
    return (
      <Panel accent="blue" className="p-3.5">
        <RaffleDrawReel
          pool={names.current}
          winner={winner}
          onDone={() => setTimeout(() => setRolling(false), 3500)}
        />
      </Panel>
    )
  }

  if (winner) {
    return (
      <Panel accent="amber" className="flex items-center gap-3 px-4 py-3">
        <Trophy className="h-5 w-5 shrink-0" style={{ color: ACCENTS.amber }} />
        <div className="min-w-0">
          <MonoLabel className="block text-white/35">Winner</MonoLabel>
          <p className="truncate text-[17px] font-semibold text-white">{winner}</p>
        </div>
        {ticketNumber != null && (
          <MonoLabel className="ml-auto shrink-0 text-white/30">Ticket #{ticketNumber}</MonoLabel>
        )}
      </Panel>
    )
  }

  // Closed, no winner yet: say so rather than leaving the page looking stuck.
  if (closed) {
    return (
      <Panel accent="blue" className="flex items-center gap-3 px-4 py-3">
        <Clock className="h-4 w-4 shrink-0 animate-pulse" style={{ color: ACCENTS.blue }} />
        <div>
          <MonoLabel className="block text-white/35">Entries closed</MonoLabel>
          <p className="text-[13px] text-white/60">
            {entries.length > 0 ? "Drawing the winner…" : "Nobody entered this one."}
          </p>
        </div>
      </Panel>
    )
  }

  return null
}
