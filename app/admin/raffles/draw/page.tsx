"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Sparkles, Trophy } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
import { RaffleHeader, RaffleRows, RaffleTotals, useAdminRaffles } from "@/components/admin/raffle-list"
import { RecordWinDialog, WinnerName } from "@/components/admin/record-win-dialog"
import { RaffleDrawReel, weightedNames } from "@/components/raffle-draw-spinner"
import { AutoHeight } from "@/components/auto-height"

/**
 * Raffles waiting on a draw.
 *
 * The draw itself moved to /api/raffles/draw. This page used to call a
 * draw_raffle_winner stored procedure that is in no migration here, so on a
 * database where it was never created the button just errored.
 */
/** Matches the raffle page, so a draw looks the same wherever you watch it. */
const ENTER = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
}

export default function DrawRafflesPage() {
  const { rows, loading, error, reload } = useAdminRaffles()
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [result, setResult] = useState<{ title: string; username: string; ticketNumber: number; totalTickets: number } | null>(
    null,
  )
  const [logWinner, setLogWinner] = useState<{ username: string; title: string } | null>(null)
  // Names to flash past while the roll plays, and the winner to land on.
  const [spin, setSpin] = useState<{ title: string; names: string[]; winner: string | null } | null>(null)

  const waiting = rows.filter((row) => row.phase === "ended")

  // Automatic raffles that closed while nobody had a page open are drawn here
  // too, so opening this page catches anything the sweep has not yet.
  const sweep = useCallback(async () => {
    const response = await fetch("/api/raffles/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due: true }),
    })
    const data = await response.json().catch(() => null)
    if (response.ok && (data?.drawn ?? []).length > 0) await reload()
  }, [reload])

  useEffect(() => {
    sweep()
  }, [sweep])

  async function draw(raffleId: string, title: string, tickets: number) {
    if (tickets === 0) {
      setProblem(`"${title}" has no entries — there is nobody to draw.`)
      return
    }
    if (!confirm(`Draw a winner for "${title}"? This cannot be undone.`)) return

    setBusy(raffleId)
    setProblem(null)
    setResult(null)

    // The wheel starts before the request, on the names as they stand. The
    // winner is decided on the server — this only shows it happening.
    const { data: entries } = await createBrowserClient()
      .from("raffle_entries")
      .select("username, tickets_purchased")
      .eq("raffle_id", raffleId)
    setSpin({ title, names: weightedNames(entries ?? []), winner: null })

    const response = await fetch("/api/raffles/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raffleId }),
    })
    const data = await response.json().catch(() => null)
    setBusy(null)

    if (!response.ok) {
      setSpin(null)
      setProblem(data?.error ?? "Could not draw a winner")
      return
    }
    // Handed to the spinner, which lands on it and only then reveals the card.
    setSpin((current) => (current ? { ...current, winner: data.username } : current))
    setResult(data)
    await reload()
  }

  return (
    <div className="space-y-4">
      <RaffleHeader
        title="Draw"
        hint="Closed raffles that still need a winner."
        loading={loading}
        onReload={reload}
      />

      {(problem || error) && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {problem ?? error}
        </Panel>
      )}

      <AutoHeight>
        <AnimatePresence mode="wait" initial={false}>
          {spin && (
            <motion.div key={spin.winner ? "reel" : "picking"} {...ENTER}>
              <Panel accent="blue" className="p-3.5">
                <MonoLabel className="mb-2 block text-white/30">{spin.title}</MonoLabel>
                {spin.winner ? (
                  <RaffleDrawReel
                    pool={spin.names}
                    winner={spin.winner}
                    onDone={() => setTimeout(() => setSpin(null), 3500)}
                  />
                ) : (
                  // The reel needs the name it lands on, so it waits for the
                  // server rather than starting on a strip it would rebuild.
                  <div className="flex h-16 items-center justify-center rounded-lg border border-white/[0.08] bg-black/40">
                    <MonoLabel className="animate-pulse text-white/30">Picking a winner</MonoLabel>
                  </div>
                )}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>

      {result && !spin && (
        <Panel accent="amber" className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Trophy className="h-5 w-5 shrink-0" style={{ color: ACCENTS.amber }} />
          <div className="min-w-0">
            <MonoLabel className="block text-white/35">{result.title}</MonoLabel>
            <WinnerName
              username={result.username}
              onClick={() => setLogWinner({ username: result.username, title: result.title })}
              className="text-[17px] font-semibold text-white"
            />
          </div>
          <MonoLabel className="text-white/30">
            Ticket #{result.ticketNumber} of {result.totalTickets}
          </MonoLabel>
          <button
            type="button"
            onClick={() => setLogWinner({ username: result.username, title: result.title })}
            className="ml-auto inline-flex h-8 items-center rounded-md px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-black transition"
            style={{ backgroundColor: ACCENTS.amber }}
          >
            Log the win
          </button>
        </Panel>
      )}

      <RaffleTotals rows={waiting} />

      {waiting.length > 0 && (
        <Panel accent="blue">
          <ul className="divide-y divide-white/[0.05]">
            {waiting.map((row) => (
              <li key={row.raffle.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{row.raffle.title}</p>
                  <p className="truncate text-[11px] text-white/30">
                    {row.raffle.prize_name} · {row.entrants} {row.entrants === 1 ? "entrant" : "entrants"} ·{" "}
                    {row.tickets} {row.tickets === 1 ? "ticket" : "tickets"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => draw(row.raffle.id, row.raffle.title, row.tickets)}
                  disabled={busy === row.raffle.id || row.tickets === 0}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ backgroundColor: ACCENTS.amber }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {busy === row.raffle.id ? "Drawing…" : row.tickets === 0 ? "No entries" : "Draw"}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <RaffleRows rows={waiting} loading={loading} empty="Nothing is waiting on a draw." />

      {logWinner && (
        <RecordWinDialog
          username={logWinner.username}
          source="raffle"
          sourceRef={logWinner.title}
          onClose={() => setLogWinner(null)}
        />
      )}
    </div>
  )
}
