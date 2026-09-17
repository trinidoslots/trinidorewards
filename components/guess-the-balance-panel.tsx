"use client"

import { useEffect, useState, useCallback } from "react"
import { Coins, Users, Lock, Send } from "lucide-react"

type GtbEntry = {
  username: string
  guessAmount: number
  createdAt?: string
}

type GtbStatus = {
  huntId?: string
  huntTitle?: string
  status?: "open" | "closed" | "rolled" | string
  isOpen?: boolean
  isRolled?: boolean
  rolledAt?: string | null
  entries?: GtbEntry[]
  entryCount?: number
  error?: string
}

type GuessTheBalancePanelProps = {
  externalHuntId: string | null
  huntTitle?: string | null
  currentUsername?: string
}

export function GuessTheBalancePanel({ externalHuntId, huntTitle, currentUsername }: GuessTheBalancePanelProps) {
  const [status, setStatus] = useState<GtbStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [guessAmount, setGuessAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const fetchStatus = useCallback(async () => {
    if (!externalHuntId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/external/hunts/${externalHuntId}/guess-the-balance`)
      const data = await res.json()
      if (res.ok) {
        setStatus(data)
      } else {
        setStatus({ error: data.error || "Failed to load guesses" })
      }
    } catch (error) {
      console.error("[v0] Error fetching guess-the-balance:", error)
      setStatus({ error: "Failed to load guesses" })
    } finally {
      setLoading(false)
    }
  }, [externalHuntId])

  // Poll every 10s to respect bonushunt.gg rate limits (100/min, 1000/hour)
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const isOpen = status?.isOpen ?? status?.status === "open"
  const isRolled = status?.isRolled ?? status?.status === "rolled"
  const entries = status?.entries || []
  const entryCount = status?.entryCount ?? entries.length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!externalHuntId) return

    if (!currentUsername) {
      setMessage("Please log in to submit a guess")
      return
    }

    const amount = Number.parseFloat(guessAmount)
    if (Number.isNaN(amount) || amount < 0) {
      setMessage("Enter a valid guess amount")
      return
    }

    setIsSubmitting(true)
    setMessage("")

    try {
      const res = await fetch("/api/external/guess-the-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          huntId: externalHuntId,
          username: currentUsername,
          guessAmount: amount,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage("Guess submitted!")
        setGuessAmount("")
        fetchStatus()
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to submit guess")
      }
    } catch (error) {
      console.error("[v0] Error submitting guess:", error)
      setMessage("An error occurred while submitting your guess")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!externalHuntId) return null

  const statusLabel = isRolled ? "Rolled" : isOpen ? "Open" : "Closed"
  const statusColor = isRolled
    ? "border-[#A78BFA]/30 bg-[#A78BFA]/15 text-[#A78BFA]"
    : isOpen
      ? "border-[#46C48A]/30 bg-[#46C48A]/15 text-[#46C48A]"
      : "border-white/12 bg-white/[0.06] text-white/45"

  return (
    <div className="mb-2.5 rounded-lg border border-white/[0.08] bg-white/[0.022] p-4">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#5B8DEF]/15 p-2">
            <Coins className="h-4 w-4 text-[#5B8DEF]" />
          </div>
          <div>
            <h2 className="text-white text-lg font-bold">Guess the Balance</h2>
            {huntTitle && <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">{huntTitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[12.5px] text-white/40">
            <Users className="w-4 h-4" />
            {entryCount} {entryCount === 1 ? "guess" : "guesses"}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Submission form */}
      {isOpen && !isRolled && (
        <form onSubmit={handleSubmit} className="mb-5">
          {currentUsername ? (
            <div className="flex gap-2 flex-wrap">
              <input
                type="number"
                step="0.01"
                min="0"
                value={guessAmount}
                onChange={(e) => setGuessAmount(e.target.value)}
                placeholder="Your balance guess (e.g., 1500.00)"
                className="h-9 min-w-[200px] flex-1 rounded-md border border-white/10 bg-black/40 px-3 text-[13px] tabular-nums text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12] disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Submitting..." : "Submit Guess"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-black/25 px-3.5 py-2.5 text-[12.5px] text-white/40">
              <Lock className="w-4 h-4" />
              Log in with Kick to submit your balance guess.
            </div>
          )}
          {message && (
            <p
              className={`mt-2 text-sm ${message.includes("submitted") ? "text-green-400" : "text-red-400"}`}
            >
              {message}
            </p>
          )}
        </form>
      )}

      {!isOpen && !isRolled && (
        <p className="mb-4 rounded-md border border-white/[0.08] bg-black/25 px-3.5 py-2.5 text-[12.5px] text-white/40">
          Guessing is currently closed for this hunt.
        </p>
      )}

      {/* Entries list */}
      {loading ? (
        <p className="py-6 text-center text-[12.5px] text-white/25">Loading guesses...</p>
      ) : status?.error ? (
        <p className="text-red-400 text-sm text-center py-6">{status.error}</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-white/25">No guesses submitted yet.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-md border border-white/[0.08]">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#0E0E11]">
              <tr className="border-b border-white/[0.08]">
                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-white/30">
                  User
                </th>
                <th className="px-4 py-2.5 text-right font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-white/30">
                  Guess
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isMe = currentUsername && entry.username === currentUsername
                return (
                  <tr
                    key={`${entry.username}-${idx}`}
                    className={`border-b border-white/[0.05] ${isMe ? "bg-[#5B8DEF]/10" : "hover:bg-white/[0.03]"}`}
                  >
                    <td className="py-2.5 px-4 text-white text-sm font-medium">
                      {entry.username}
                      {isMe && <span className="ml-2 text-[11px] text-[#5B8DEF]">(you)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-[#5B8DEF]">
                      ${Number(entry.guessAmount).toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
