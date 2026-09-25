"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, ExternalLink, Trophy, UserX, X } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { EntrantAvatar, GiveawayReel } from "@/components/giveaway-reel"

/**
 * The roll, as the admin sees it: the reel in a dialog over the page, and when
 * it lands, a short card on the winner under it.
 *
 * Timed from the same start the widget uses (the roll's updated_at plus the
 * hold), so the name appears here when it appears on stream, not before.
 *
 * The card says whether the Kick name belongs to an account on the site, and
 * offers the four things you do next: open that account, log the win, take
 * them out of the entries (a wrong or ineligible winner), or close.
 */

export type RollView = {
  /** Who was in the draw, in the order written to the widget. */
  pool: string[]
  winner: string
  /** Epoch ms at which the reel starts moving. */
  startAt: number
  durationMs: number
  /** Entrants in the round, for "rolled from N". */
  total: number
}

type Account = { id: string; username: string; avatar_url: string | null } | null

const KICK_GREEN = "#53FC18"

function KickGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M2 3h6v5h3V5.5h3V3h6v6h-3v3h-3v3h3v3h3v6h-6v-2.5h-3V19H8v5H2V3z" />
    </svg>
  )
}

export function GiveawayRollDialog({
  view,
  avatars,
  onLog,
  onRemove,
  onDone,
}: {
  view: RollView
  avatars: Record<string, string | null | undefined>
  onLog: (username: string, userId: string | null) => void
  onRemove: (username: string) => void
  onDone: () => void
}) {
  const [landed, setLanded] = useState(Date.now() >= view.startAt + view.durationMs)
  const [account, setAccount] = useState<Account | "loading">("loading")

  // Looked up while the reel runs, so the card is complete when it opens.
  useEffect(() => {
    let cancelled = false
    setAccount("loading")
    fetch(`/api/admin/users/lookup?username=${encodeURIComponent(view.winner)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return
        const user = payload?.user as Account
        // The lookup matches with ILIKE, where "_" is a wildcard and Kick names
        // are full of them. Only an exact (case-insensitive) name counts.
        setAccount(user && user.username?.toLowerCase() === view.winner.toLowerCase() ? user : null)
      })
      .catch(() => !cancelled && setAccount(null))
    return () => {
      cancelled = true
    }
  }, [view.winner])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && landed) onDone()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [landed, onDone])

  const registered = account !== "loading" && account !== null
  const picture = (registered ? account.avatar_url : null) ?? avatars[view.winner] ?? null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-[600px] rounded-2xl border border-white/[0.10] bg-[#141418] p-4 shadow-2xl shadow-black/60"
        role="dialog"
        aria-label="Giveaway roll"
      >
        <button
          type="button"
          onClick={onDone}
          disabled={!landed}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-0"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="rounded-xl border border-white/[0.06] bg-black/30 px-2 py-3">
          <GiveawayReel
            entrants={view.pool}
            winner={view.winner}
            avatars={avatars}
            startAt={view.startAt}
            durationMs={view.durationMs}
            size="large"
            onLanded={() => setLanded(true)}
          />
        </div>

        <AnimatePresence>
          {landed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-center gap-1.5 pb-2 pt-5 text-center">
                <EntrantAvatar name={view.winner} url={picture} size={64} />
                <p className="mt-1 text-[22px] font-bold tracking-tight text-white">
                  {registered ? account.username : view.winner}
                </p>
                <p className="text-[12px] text-white/40">
                  Rolled from {view.total.toLocaleString("en-US")} {view.total === 1 ? "entrant" : "entrants"}
                </p>
                <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-white/70">
                  <KickGlyph className="h-3.5 w-3.5" />
                  <span style={{ color: KICK_GREEN }} className="sr-only">
                    Kick
                  </span>
                  {view.winner}
                </p>
                {account === "loading" ? (
                  <span className="h-6 w-24 animate-pulse rounded-md bg-white/[0.05]" />
                ) : registered ? (
                  <span
                    className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                    style={{ borderColor: `${ACCENTS.green}55`, backgroundColor: `${ACCENTS.green}14`, color: ACCENTS.green }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Registered
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2 py-0.5 text-[11px] font-semibold text-white/45">
                    <UserX className="h-3.5 w-3.5" /> No account on the site
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    onRemove(view.winner)
                    onDone()
                  }}
                  className="text-[12px] text-white/40 transition hover:text-white"
                >
                  Remove from entries
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {registered && (
                    <Link
                      href={`/admin/users/${account.id}`}
                      target="_blank"
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.10] px-3 text-[13px] text-white/80 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View profile
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => onLog(view.winner, registered ? account.id : null)}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.10] px-3 text-[13px] text-white/80 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <Trophy className="h-3.5 w-3.5" /> Add to winner log
                  </button>
                  <button
                    type="button"
                    onClick={onDone}
                    className="flex h-9 items-center rounded-lg px-4 text-[13px] font-semibold text-white transition hover:brightness-110"
                    style={{ backgroundColor: ACCENTS.purple }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
