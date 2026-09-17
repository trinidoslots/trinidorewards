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
    ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
    : isOpen
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : "bg-slate-500/20 text-slate-300 border-slate-500/30"

  return (
    <div className="bg-white/5 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/20 rounded-lg p-2">
            <Coins className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-white text-lg font-bold">Guess the Balance</h2>
            {huntTitle && <p className="text-slate-400 text-xs">{huntTitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-400 text-sm">
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
                className="flex-1 min-w-[200px] bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Submitting..." : "Submit Guess"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm bg-slate-800/40 rounded-lg px-4 py-3">
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
        <p className="text-slate-400 text-sm mb-5 bg-slate-800/40 rounded-lg px-4 py-3">
          Guessing is currently closed for this hunt.
        </p>
      )}

      {/* Entries list */}
      {loading ? (
        <p className="text-slate-500 text-sm text-center py-6">Loading guesses...</p>
      ) : status?.error ? (
        <p className="text-red-400 text-sm text-center py-6">{status.error}</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">No guesses submitted yet.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700/50">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-900/90 backdrop-blur">
              <tr className="border-b border-slate-700">
                <th className="text-left py-2.5 px-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  User
                </th>
                <th className="text-right py-2.5 px-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">
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
                    className={`border-b border-slate-700/40 ${isMe ? "bg-cyan-500/10" : "hover:bg-white/5"}`}
                  >
                    <td className="py-2.5 px-4 text-white text-sm font-medium">
                      {entry.username}
                      {isMe && <span className="ml-2 text-cyan-400 text-xs">(you)</span>}
                    </td>
                    <td className="py-2.5 px-4 text-cyan-400 text-sm font-medium text-right">
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
