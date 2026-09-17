"use client"

import { useEffect, useState } from "react"
import { Crown, X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { decideMatch, money, multiplier, type Match, type Participant } from "@/lib/tournament"

/**
 * "Enter payouts" for one match.
 *
 * Both payouts are entered rather than a winner being clicked, because the
 * payout is the thing that is actually known at the table and the winner falls
 * out of it. Entering it the other way round loses the numbers the overlay and
 * the history are built from.
 */
export function TournamentResultDialog({
  match,
  p1,
  p2,
  saving,
  onSave,
  onClose,
}: {
  match: Match
  p1: Participant
  p2: Participant
  saving: boolean
  onSave: (p1Payout: number, p2Payout: number) => void
  onClose: () => void
}) {
  const [left, setLeft] = useState(match.p1_payout === null ? "" : String(match.p1_payout))
  const [right, setRight] = useState(match.p2_payout === null ? "" : String(match.p2_payout))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // An empty field is not zero: a real payout of 0 has to be typed, otherwise
  // an untouched form would silently hand the match to the other side.
  const leftValue = left.trim() === "" ? Number.NaN : Number(left)
  const rightValue = right.trim() === "" ? Number.NaN : Number(right)
  const outcome = decideMatch(leftValue, rightValue)
  const winner = "winner" in outcome && outcome.winner !== null ? outcome.winner : null
  const problem = "reason" in outcome ? outcome.reason : null

  const sides: { side: 1 | 2; participant: Participant; raw: string; set: (value: string) => void }[] = [
    { side: 1, participant: p1, raw: left, set: setLeft },
    { side: 2, participant: p2, raw: right, set: setRight },
  ]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Enter payouts"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-white/[0.10] bg-[#0E0E11]"
      >
        <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <MonoLabel className="text-white/70">Enter payouts</MonoLabel>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-2.5 p-4">
          {sides.map(({ side, participant, raw, set }) => {
            const payout = raw.trim() === "" ? null : Number(raw)
            const times = multiplier(Number.isFinite(payout as number) ? payout : null, Number(participant.buy_amount))
            const isWinner = winner === side
            return (
              <div
                key={side}
                className="rounded-lg border bg-white/[0.022] p-3 transition"
                style={{ borderColor: isWinner ? `${ACCENTS.green}66` : "rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold text-white">{participant.username}</span>
                  {participant.is_super && <MonoLabel style={{ color: ACCENTS.amber }}>Super</MonoLabel>}
                  {isWinner && <Crown className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} />}
                  <span className="ml-auto truncate text-[12px] text-white/35">
                    {participant.game_name ?? "—"}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  <label className="flex-1">
                    <MonoLabel className="mb-1 block text-white/30">Payout</MonoLabel>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-white/30">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={raw}
                        onChange={(event) => set(event.target.value)}
                        className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 pl-7 pr-3 text-[13px] tabular-nums text-white outline-none transition focus:border-white/25"
                      />
                    </div>
                  </label>
                  <div className="w-24 shrink-0">
                    <MonoLabel className="mb-1 block text-white/30">Buy</MonoLabel>
                    <p className="h-9 text-[13px] leading-9 tabular-nums text-white/50">
                      {money(participant.buy_amount)}
                    </p>
                  </div>
                  <div className="w-20 shrink-0">
                    <MonoLabel className="mb-1 block text-white/30">×</MonoLabel>
                    <p
                      className="h-9 text-[13px] leading-9 tabular-nums"
                      style={{ color: times === null ? "rgba(255,255,255,0.2)" : ACCENTS.blue }}
                    >
                      {times === null ? "—" : `${times.toFixed(2)}x`}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}

          {problem && <p className="text-[12px]" style={{ color: ACCENTS.amber }}>{problem}</p>}
        </div>

        <footer className="flex items-center gap-2 border-t border-white/[0.08] px-4 py-3">
          <MonoLabel className="text-white/30">
            {winner ? `${winner === 1 ? p1.username : p2.username} advances` : "Both payouts needed"}
          </MonoLabel>
          <button
            type="button"
            disabled={!winner || saving}
            onClick={() => winner && onSave(leftValue, rightValue)}
            className="ml-auto inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: ACCENTS.green }}
          >
            {saving ? "Saving…" : "Save result"}
          </button>
        </footer>
      </div>
    </div>
  )
}
