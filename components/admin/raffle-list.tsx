"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Gift, Pencil, RefreshCw, Ticket, Trash2, Trophy, Users } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"
import { calculateRaffleStatus, formatDrawDate } from "@/lib/raffle-utils"

/**
 * Shared loader and list for the admin raffle pages.
 *
 * Status is derived from the dates, not read from raffles.status. That column
 * is only refreshed by an update_raffle_status procedure that may never have
 * run — the Active page filtered on it and could show nothing while a raffle
 * was plainly open.
 *
 * Ticket counts come off the raffle row rather than a scan of every entry, for
 * the same reason as the public page: that scan grows without limit.
 */

export type AdminRaffle = {
  id: string
  title: string
  description: string | null
  prize_name: string
  prize_value: number | null
  ticket_price: number
  max_tickets: number | null
  total_tickets_available: number | null
  auto_draw: boolean | null
  is_hidden: boolean | null
  tickets_sold: number | null
  entrant_count: number | null
  start_date: string
  end_date: string
  draw_date: string | null
  winner_username: string | null
  winner_ticket_number: number | null
  featured: boolean
  entry_type: string | null
}

export type Phase = "upcoming" | "active" | "ended" | "drawn"

export type RaffleRow = { raffle: AdminRaffle; phase: Phase; tickets: number; entrants: number }

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

export function useAdminRaffles() {
  const supabaseRef = useRef(createBrowserClient())
  const [rows, setRows] = useState<RaffleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = supabaseRef.current

    const { data: raffles, error: problem } = await supabase
      .from("raffles")
      .select("*")
      .order("created_at", { ascending: false })

    if (problem) {
      console.error("[v0] Error fetching raffles:", problem)
      setError(problem.message || "Could not load raffles")
      setLoading(false)
      return
    }

    setRows(
      ((raffles ?? []) as AdminRaffle[]).map((raffle) => ({
        raffle,
        phase: raffle.winner_username
          ? ("drawn" as Phase)
          : (calculateRaffleStatus(raffle.start_date, raffle.end_date) as Phase),
        tickets: Number(raffle.tickets_sold) || 0,
        entrants: Number(raffle.entrant_count) || 0,
      })),
    )
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { rows, loading, error, reload: load, supabase: supabaseRef.current, setRows }
}

export function RaffleHeader({
  title,
  hint,
  loading,
  onReload,
  children,
}: {
  title: string
  hint: string
  loading: boolean
  onReload: () => void
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-[13px] text-white/40">{hint}</p>
      </div>
      <div className="flex gap-2">
        {children}
        <button
          type="button"
          onClick={onReload}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </header>
  )
}

export function RaffleTotals({ rows }: { rows: RaffleRow[] }) {
  const totals = useMemo(
    () => ({
      raffles: rows.length,
      tickets: rows.reduce((sum, row) => sum + row.tickets, 0),
      prize: rows.reduce((sum, row) => sum + (Number(row.raffle.prize_value) || 0), 0),
    }),
    [rows],
  )

  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      <StatTile label="Raffles" value={totals.raffles.toLocaleString()} />
      <StatTile label="Tickets sold" value={points(totals.tickets)} accent="blue" />
      <StatTile label="Prize value" value={"$" + points(totals.prize)} accent="amber" />
    </div>
  )
}

export function RaffleRows({
  rows,
  loading,
  empty,
  onDelete,
  onToggleHidden,
}: {
  rows: RaffleRow[]
  loading: boolean
  empty: string
  onDelete?: (row: RaffleRow) => void
  /** Hiding takes it off the public page but keeps the record of who won. */
  onToggleHidden?: (row: RaffleRow, hidden: boolean) => void
}) {
  if (loading) {
    return (
      <Panel className="py-16 text-center">
        <MonoLabel className="text-white/25">Loading</MonoLabel>
      </Panel>
    )
  }

  if (rows.length === 0) {
    return (
      <Panel className="flex flex-col items-center gap-2 py-16">
        <Gift className="h-7 w-7 text-white/10" />
        <p className="text-[13px] text-white/30">{empty}</p>
      </Panel>
    )
  }

  return (
    <Panel>
      <ul className="divide-y divide-white/[0.05]">
        {rows.map((row) => {
          const raffle = row.raffle
          const accent =
            row.phase === "active"
              ? "green"
              : row.phase === "upcoming"
                ? "blue"
                : row.phase === "drawn"
                  ? "amber"
                  : "slate"
          const cap = raffle.total_tickets_available == null ? null : Number(raffle.total_tickets_available)
          const isFree = Number(raffle.ticket_price) === 0 || raffle.entry_type === "free"

          return (
            <li
              key={raffle.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3"
              style={{ opacity: raffle.is_hidden ? 0.45 : 1 }}
            >
              <Tag accent={accent}>{row.phase}</Tag>
              {raffle.is_hidden && <Tag accent="slate">Hidden</Tag>}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <Link
                    href={"/raffles/" + raffle.id}
                    className="truncate text-[13px] font-medium text-white underline-offset-4 hover:underline"
                  >
                    {raffle.title}
                  </Link>
                  {raffle.featured && <MonoLabel style={{ color: ACCENTS.amber }}>Featured</MonoLabel>}
                </div>
                <p className="truncate text-[11px] text-white/30">
                  {raffle.prize_name}
                  {raffle.winner_username ? " · won by " + raffle.winner_username : ""}
                  {!raffle.winner_username && raffle.auto_draw ? " · draws itself" : ""}
                </p>
              </div>

              <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-white/40">
                <Users className="h-3 w-3" />
                {row.entrants}
              </span>
              <span className="flex w-24 shrink-0 items-center justify-end gap-1.5 text-[12px] text-white/50">
                <Ticket className="h-3 w-3" />
                {points(row.tickets)}
                {cap !== null && <span className="text-white/20">/{points(cap)}</span>}
              </span>

              <span
                className="w-20 shrink-0 text-right text-[13px] font-semibold"
                style={{ color: isFree ? ACCENTS.green : ACCENTS.blue }}
              >
                {isFree ? "Free" : points(raffle.ticket_price)}
              </span>

              <MonoLabel className="w-32 shrink-0 text-right text-white/20">
                {row.phase === "upcoming" ? formatDrawDate(raffle.start_date) : formatDrawDate(raffle.end_date)}
              </MonoLabel>

              <div className="flex shrink-0 gap-1">
                {onToggleHidden && (
                  <button
                    type="button"
                    onClick={() => onToggleHidden(row, !raffle.is_hidden)}
                    aria-label={(raffle.is_hidden ? "Show " : "Hide ") + raffle.title}
                    title={raffle.is_hidden ? "Show on the site" : "Hide from the site"}
                    className="rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    {raffle.is_hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
                {row.phase === "drawn" ? (
                  <Trophy className="m-1.5 h-3.5 w-3.5" style={{ color: ACCENTS.amber }} />
                ) : (
                  <Link
                    href={"/admin/raffles/edit/" + raffle.id}
                    aria-label={"Edit " + raffle.title}
                    className="rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    aria-label={"Delete " + raffle.title}
                    className="rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
