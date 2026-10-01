"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, Ticket } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

/**
 * Buying tickets.
 *
 * It used to be a single "Enter" button, which matched a backend that refused a
 * second entry outright — a raffle with a five-ticket limit could only ever
 * sell one. The quantity picker only appears when more than one is actually
 * allowed, so a one-per-person raffle still reads as one button.
 */
export default function RaffleEntryButton({
  raffleId,
  isFree,
  ticketPrice,
  alreadyHolding = 0,
  perUserCap = null,
}: {
  raffleId: string
  isFree: boolean
  ticketPrice: number
  alreadyHolding?: number
  perUserCap?: number | null
}) {
  const router = useRouter()
  const [tickets, setTickets] = useState(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const remaining = perUserCap === null ? Infinity : Math.max(0, perUserCap - alreadyHolding)
  const canPickMore = remaining > 1
  const cost = isFree ? 0 : ticketPrice * tickets

  async function enter() {
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch("/api/raffles/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raffleId, tickets }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage({ tone: "error", text: data?.error ?? "Could not enter the raffle" })
        return
      }
      setMessage({
        tone: "ok",
        text: `You now hold ${data.tickets} ${data.tickets === 1 ? "ticket" : "tickets"}.`,
      })
      // Refresh so the entrant list, odds and progress reflect the purchase.
      router.refresh()
    } catch (error) {
      console.error("[v0] Error entering raffle:", error)
      setMessage({ tone: "error", text: "Could not reach the server" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {canPickMore && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/30 p-1.5">
          <button
            type="button"
            aria-label="One fewer ticket"
            onClick={() => setTickets((current) => Math.max(1, current - 1))}
            disabled={tickets <= 1}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-[22px] font-black leading-none tabular-nums text-white">{tickets}</p>
            <MonoLabel className="text-white/40">{tickets === 1 ? "ticket" : "tickets"}</MonoLabel>
          </div>
          <button
            type="button"
            aria-label="One more ticket"
            onClick={() => setTickets((current) => Math.min(remaining, current + 1))}
            disabled={tickets >= remaining}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={enter}
        disabled={loading}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-black transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: ACCENTS.green, boxShadow: `0 10px 34px -14px ${ACCENTS.green}` }}
      >
        <Ticket className="h-[18px] w-[18px]" />
        {loading ? "Entering…" : isFree ? "Enter free" : `Enter · ${cost.toLocaleString()} pts`}
      </button>

      {message && (
        <p
          className="text-center text-[13px]"
          style={{ color: message.tone === "ok" ? ACCENTS.green : ACCENTS.red }}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
