"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Crown, Trophy } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { TournamentBracketBoard } from "@/components/tournament-bracket-board"
import { TournamentBracketView } from "@/components/tournament-bracket-view"
import { useTournamentLive } from "@/hooks/use-tournament-live"
import { money, standings, tournamentTotals } from "@/lib/tournament"

/**
 * One tournament, as the audience sees it.
 *
 * Reads the participant/payout model the console writes. Tournaments created
 * before that model existed have no participants and are still held in
 * tournament_slots, so those fall back to the old slot view rather than
 * rendering an empty bracket — the history stays readable.
 */
export default function TournamentDetailPage() {
  const params = useParams()
  const tournamentId = params.id as string

  const { tournament, participants, matches, loading } = useTournamentLive({ id: tournamentId })
  const [legacySlots, setLegacySlots] = useState<number | null>(null)
  const [meta, setMeta] = useState<{ prize_pool: number; max_participants: number; description: string | null } | null>(
    null,
  )
  const supabaseRef = useRef(createBrowserClient())

  // The live hook deliberately selects only the bracket columns; the public
  // page also wants the presentation fields, and the legacy slot count decides
  // which bracket is rendered.
  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    ;(async () => {
      const [{ data: row }, { count }] = await Promise.all([
        supabase
          .from("tournaments")
          .select("prize_pool, max_participants, description")
          .eq("id", tournamentId)
          .maybeSingle(),
        supabase
          .from("tournament_slots")
          .select("slot_position", { count: "exact", head: true })
          .eq("tournament_id", tournamentId),
      ])
      if (cancelled) return
      if (row) {
        setMeta({
          prize_pool: Number(row.prize_pool) || 0,
          max_participants: Number(row.max_participants) || 0,
          description: row.description ?? null,
        })
      }
      setLegacySlots(count ?? 0)
    })()

    return () => {
      cancelled = true
    }
  }, [tournamentId])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center">
        <MonoLabel className="text-white/25">Loading</MonoLabel>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center">
        <Trophy className="mx-auto h-10 w-10 text-white/10" />
        <p className="mt-3 text-[14px] text-white/40">That tournament does not exist.</p>
        <Link
          href="/tournaments"
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All tournaments
        </Link>
      </div>
    )
  }

  const size = tournament.bracket_size ?? meta?.max_participants ?? participants.length
  const totals = tournamentTotals(participants, matches, size || 1)
  const rows = standings(participants, matches)
  const champion = tournament.champion_participant_id
    ? participants.find((participant) => participant.id === tournament.champion_participant_id) ?? null
    : null
  const isBattle = participants.length > 0
  const statusAccent =
    tournament.bracket_status === "finished" ? "slate" : tournament.bracket_status === "running" ? "green" : "amber"

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-6">
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 transition hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        All tournaments
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{tournament.title}</h1>
          {meta?.description && <p className="mt-1 max-w-2xl text-[13px] text-white/40">{meta.description}</p>}
        </div>
        <Tag accent={statusAccent}>{(tournament.bracket_status ?? "registration").replace("_", " ")}</Tag>
      </header>

      {champion && (
        <Panel accent="amber" className="flex items-center gap-3 px-4 py-3">
          <Crown className="h-5 w-5 shrink-0" style={{ color: ACCENTS.amber }} />
          <div className="min-w-0">
            <MonoLabel className="block text-white/35">Champion</MonoLabel>
            <p className="truncate text-[17px] font-semibold text-white">{champion.username}</p>
          </div>
          <p className="ml-auto shrink-0 text-right text-[13px] text-white/35">
            {champion.game_name ?? "No slot recorded"}
          </p>
        </Panel>
      )}

      {isBattle ? (
        <>
          <div className="grid gap-2.5 sm:grid-cols-4">
            <StatTile label="Players" value={totals.participants} />
            <StatTile label="Bought in" value={money(totals.totalBuyIn)} accent="amber" />
            <StatTile label="Paid out" value={money(totals.totalPaidOut)} accent="green" />
            <StatTile
              label="Matches played"
              value={totals.matchesPlayed + "/" + totals.matchesTotal}
              accent="blue"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <Panel accent="amber">
              <PanelHeader title="Standings" accent="amber" />
              <ul className="divide-y divide-white/[0.05]">
                {rows.map((row, index) => (
                  <li
                    key={row.participant.id}
                    className="flex items-center gap-2.5 px-3.5 py-2.5"
                    style={{ opacity: row.eliminated ? 0.45 : 1 }}
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/25">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-[13px] font-medium text-white">
                          {row.participant.username}
                        </span>
                        {row.participant.is_super && (
                          <MonoLabel style={{ color: ACCENTS.amber }}>Super</MonoLabel>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-white/30">
                        {row.participant.game_name ?? "No slot"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] tabular-nums text-white/80">
                        {row.bestPayout === null ? "—" : money(row.bestPayout)}
                      </p>
                      <p className="font-mono text-[11px] tabular-nums" style={{ color: ACCENTS.blue }}>
                        {row.bestMultiplier === null ? "" : row.bestMultiplier.toFixed(2) + "x"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel accent="purple">
              <PanelHeader title="Bracket" accent="purple" />
              <div className="p-3">
                <TournamentBracketBoard size={size} matches={matches} participants={participants} />
              </div>
            </Panel>
          </div>
        </>
      ) : legacySlots === null ? (
        <Panel className="py-12 text-center">
          <MonoLabel className="text-white/25">Loading</MonoLabel>
        </Panel>
      ) : legacySlots > 0 ? (
        // Pre-console tournament: the field only ever existed as named slots.
        <TournamentBracketView tournamentId={tournamentId} maxParticipants={meta?.max_participants ?? 0} />
      ) : (
        <Panel className="py-12 text-center">
          <Trophy className="mx-auto h-8 w-8 text-white/10" />
          <p className="mt-3 text-[13px] text-white/30">The bracket has not been drawn yet.</p>
        </Panel>
      )}
    </div>
  )
}
