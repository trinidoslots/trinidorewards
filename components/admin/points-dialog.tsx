"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { nextBalance, type PointsAction } from "@/lib/points"

/**
 * Adding, removing or setting someone's points.
 *
 * Shared by the user list and the user's own page so the two cannot disagree
 * about what "remove" does. The arithmetic lives in lib/points, which is what
 * makes it checkable.
 */

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

export function PointsDialog({
  username,
  balance,
  onClose,
  onApply,
}: {
  username: string
  balance: number
  onClose: () => void
  onApply: (action: PointsAction, amount: number, next: number) => Promise<void>
}) {
  const [action, setAction] = useState<PointsAction>("add")
  const [raw, setRaw] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const amount = Number.parseInt(raw, 10)
  // Setting to zero is a legitimate correction; adding or removing nothing is not.
  const valid = Number.isFinite(amount) && (action === "set" ? amount >= 0 : amount > 0)
  const preview = valid ? nextBalance(balance, action, amount) : null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Adjust points for ${username}`}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-white/[0.10] bg-[#0E0E11]"
      >
        <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <MonoLabel className="text-white/70">Points</MonoLabel>
          <span className="truncate text-[13px] text-white/40">{username}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            {(["add", "remove", "set"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAction(option)}
                className="rounded-md border py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition"
                style={
                  action === option
                    ? { borderColor: `${ACCENTS.blue}77`, backgroundColor: `${ACCENTS.blue}1f`, color: ACCENTS.blue }
                    : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                }
              >
                {option}
              </button>
            ))}
          </div>

          <div>
            <MonoLabel className="mb-1.5 block text-white/30">Amount</MonoLabel>
            <input
              type="number"
              min="0"
              autoFocus
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && valid && !busy) {
                  event.preventDefault()
                  void apply()
                }
              }}
              className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] tabular-nums text-white outline-none transition focus:border-white/25"
            />
          </div>

          <p className="text-[12px] text-white/35">
            {points(balance)}
            {preview !== null && (
              <>
                {" → "}
                <span style={{ color: preview >= balance ? ACCENTS.green : ACCENTS.amber }}>{points(preview)}</span>
              </>
            )}
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={apply}
            className="inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: ACCENTS.green }}
          >
            {busy ? "Saving…" : "Apply"}
          </button>
        </footer>
      </div>
    </div>
  )

  async function apply() {
    if (!valid || preview === null) return
    setBusy(true)
    await onApply(action, amount, preview)
    setBusy(false)
  }
}
