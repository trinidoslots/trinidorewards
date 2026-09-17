"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Trophy, UserRound, X } from "lucide-react"
import { ACCENTS, MonoLabel, Tag } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"
import { sourceMeta, type WinSource } from "@/lib/wins"

/**
 * Click a winner anywhere in the admin, record what they won.
 *
 * Shared by the giveaway, prediction and tournament pages so a win is logged
 * the same way wherever it happened. It looks the account up by name, but never
 * requires one: giveaway winners come out of Kick chat and many have never
 * signed in here. The username is what gets recorded either way.
 */

type Matched = {
  id: string
  username: string
  kick_id: string | null
  avatar_url: string | null
  points_balance: number
  created_at: string
}

type RecentWin = { id: string; prize: string; source: string; created_at: string }

const fieldClass =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

export function RecordWinDialog({
  username,
  userId,
  source,
  sourceRef,
  defaultPrize = "",
  onClose,
  onSaved,
}: {
  /** The name as it appeared wherever they won. Optional when an id is given. */
  username?: string
  /** The onsite id. Preferred: names change, ids do not. */
  userId?: string
  source: WinSource
  sourceRef?: string
  defaultPrize?: string
  onClose: () => void
  onSaved?: () => void
}) {
  const [user, setUser] = useState<Matched | null>(null)
  const [recent, setRecent] = useState<RecentWin[]>([])
  const [looking, setLooking] = useState(true)

  const [prize, setPrize] = useState(defaultPrize)
  const [amount, setAmount] = useState("")
  const [points, setPoints] = useState("")
  const [note, setNote] = useState("")
  const [markPaid, setMarkPaid] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLooking(true)
    try {
      const query = userId
        ? `id=${encodeURIComponent(userId)}`
        : `username=${encodeURIComponent(username ?? "")}`
      const response = await fetch(`/api/admin/users/lookup?${query}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)

      if (response.ok) {
        setUser(payload?.user ?? null)
        setRecent((payload?.recentWins ?? []) as RecentWin[])
        setError(null)
      } else {
        setUser(null)
        setError(payload?.error ?? "Could not find that user")
      }
    } finally {
      setLooking(false)
    }
  }, [userId, username])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function save() {
    if (!prize.trim()) {
      setError("Say what they won.")
      return
    }
    if (!user && !username) {
      setError("No user to record this against.")
      return
    }
    setBusy(true)
    setError(null)

    const response = await fetch("/api/admin/wins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // The account's own name when it was matched, so the log does not
        // preserve a chat nickname that has since been changed.
        username: user?.username ?? username,
        user_id: user?.id ?? null,
        source,
        source_ref: sourceRef ?? null,
        prize,
        amount,
        points,
        note,
        status: markPaid ? "paid" : "pending",
      }),
    })
    const payload = await response.json().catch(() => null)
    setBusy(false)

    if (!response.ok) {
      setError(payload?.error ?? "Could not record that win")
      return
    }
    setSaved(true)
    onSaved?.()
    await load()
    // Cleared rather than closed: a giveaway often hands the same person two
    // things, and reopening the dialog for that is needless.
    setPrize("")
    setAmount("")
    setPoints("")
    setNote("")
  }

  const meta = sourceMeta(source)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Record a win for ${user?.username ?? username ?? userId}`}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-auto rounded-lg border border-white/[0.10] bg-[#0E0E11]"
      >
        <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <Trophy className="h-4 w-4" style={{ color: ACCENTS.amber }} />
          <MonoLabel className="text-white/70">Record a win</MonoLabel>
          <Tag accent={meta.accent}>{meta.label}</Tag>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center gap-3 border-b border-white/[0.08] p-4">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-11 w-11 shrink-0 rounded-lg border border-white/[0.08] object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <UserRound className="h-5 w-5 text-white/20" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">
              {user?.username ?? username ?? "Unknown"}
            </p>
            {looking ? (
              <MonoLabel className="text-white/25">Looking up…</MonoLabel>
            ) : user ? (
              <div className="mt-0.5 flex items-center gap-2">
                {/* The id first: it is what the win is filed under. */}
                <MonoLabel className="text-white/25">ID</MonoLabel>
                <CopyableId value={user.id} chars={6} />
                <span className="text-[12px] tabular-nums" style={{ color: ACCENTS.green }}>
                  {Math.round(Number(user.points_balance) || 0).toLocaleString()} pts
                </span>
              </div>
            ) : (
              // Stated rather than hidden: the admin should know the win is
              // going on a name with no account behind it.
              <MonoLabel style={{ color: ACCENTS.amber }}>No account matched</MonoLabel>
            )}
          </div>

          {user && (
            <Link
              href={`/admin/users/${user.id}`}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/[0.10] px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
            >
              Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {recent.length > 0 && (
          <div className="border-b border-white/[0.08] px-4 py-2.5">
            <MonoLabel className="text-white/25">Previous wins</MonoLabel>
            <ul className="mt-1.5 space-y-1">
              {recent.map((win) => (
                <li key={win.id} className="flex items-baseline gap-2 text-[12px]">
                  <span className="truncate text-white/60">{win.prize}</span>
                  <span className="ml-auto shrink-0 text-white/20">
                    {new Date(win.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3 p-4">
          <div>
            <MonoLabel className="mb-1.5 block text-white/30">Prize</MonoLabel>
            <input
              autoFocus
              value={prize}
              onChange={(event) => setPrize(event.target.value)}
              placeholder="What they won"
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <MonoLabel className="mb-1.5 block text-white/30">Cash value</MonoLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-white/30">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className={`${fieldClass} pl-7 tabular-nums`}
                />
              </div>
            </div>
            <div>
              <MonoLabel className="mb-1.5 block text-white/30">Points</MonoLabel>
              <input
                type="number"
                min="0"
                value={points}
                onChange={(event) => setPoints(event.target.value)}
                placeholder="0"
                className={`${fieldClass} tabular-nums`}
              />
            </div>
          </div>

          <div>
            <MonoLabel className="mb-1.5 block text-white/30">Note</MonoLabel>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-white/60">
            <input
              type="checkbox"
              checked={markPaid}
              onChange={(event) => setMarkPaid(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#46C48A]"
            />
            Already paid out
          </label>

          {error && (
            <p className="text-[12px]" style={{ color: ACCENTS.red }}>
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="text-[12px]" style={{ color: ACCENTS.green }}>
              Recorded. Add another, or close.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            Close
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !prize.trim()}
            className="inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: ACCENTS.amber }}
          >
            {busy ? "Saving…" : "Record win"}
          </button>
        </footer>
      </div>
    </div>
  )
}

/**
 * A winner's name as a clickable thing. Kept here so the affordance reads the
 * same on all three pages — a dotted underline that fills in on hover.
 */
export function WinnerName({
  username,
  onClick,
  className,
  children,
}: {
  username: string
  onClick: () => void
  className?: string
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Record a win for ${username}`}
      className={`cursor-pointer decoration-dotted underline-offset-4 transition hover:underline ${className ?? ""}`}
    >
      {children ?? username}
    </button>
  )
}
