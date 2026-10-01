"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Crown, ImageIcon, Swords, Trophy } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"
import { TournamentBracketBoard } from "@/components/tournament-bracket-board"
import { TournamentBracketView } from "@/components/tournament-bracket-view"
import { useTournamentLive } from "@/hooks/use-tournament-live"
import { money, standings, tournamentTotals } from "@/lib/tournament"
import { PageBody, PageHero, PageHeroSkeleton } from "@/components/page-hero"
import { multiColor } from "@/components/hunt-kpi-board"

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
    // The header's own shape, so the real one fills in rather than replacing
    // a stand-in.
    return (
      <div>
        <PageHeroSkeleton accent="purple" panel />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div>
        <PageHero accent="slate" title="Not found" subtitle="That tournament does not exist." actions={<BackLink />} />
      </div>
    )
  }

  const size = tournament.bracket_size ?? meta?.max_participants ?? participants.length
  const totals = tournamentTotals(participants, matches, size || 1)
  const rows = standings(participants, matches)
  const champion = tournament.champion_participant_id
    ? participants.find((participant) => participant.id === tournament.champion_participant_id) ?? null
    : null
  const championRow = champion ? rows.find((row) => row.participant.id === champion.id) ?? null : null
  const isBattle = participants.length > 0
  const phase = tournament.bracket_status ?? "registration"
  const statusAccent: Accent = phase === "finished" ? "slate" : phase === "running" ? "green" : "blue"
  const statusLabel = phase === "finished" ? "Finished" : phase === "running" ? "Live" : "Taking entries"

  return (
    <div>
      <PageHero
        accent={statusAccent}
        title={tournament.title}
        subtitle={meta?.description}
        note={statusLabel}
        figure={meta && meta.prize_pool > 0 ? money(meta.prize_pool) : undefined}
        figureLabel="Prize pool"
        actions={<BackLink />}
      />
      <PageBody className="space-y-6">
        {champion && (
          <div
            className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-xl border p-5 sm:p-6"
            style={{ borderColor: `${GOLD}55`, background: `radial-gradient(600px 220px at 0% 0%, ${GOLD}24, transparent 70%), #0E0E12` }}
          >
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${GOLD}1f`, border: `1px solid ${GOLD}55` }}
            >
              <Crown className="h-7 w-7" style={{ color: GOLD }} />
            </span>
            <div className="min-w-0 flex-1">
              <MonoLabel style={{ color: GOLD }}>Champion</MonoLabel>
              <p className="mt-1.5 truncate text-[clamp(22px,3vw,30px)] font-black leading-none text-white">{champion.username}</p>
              <p className="mt-2 truncate text-[13px] text-white/50">{champion.game_name ?? "No slot recorded"}</p>
            </div>
            {championRow?.bestPayout != null && (
              <div className="text-right">
                <p className="text-[24px] font-black leading-none tabular-nums text-white">{money(championRow.bestPayout)}</p>
                {championRow.bestMultiplier != null && (
                  <p className="mt-1.5 text-[14px] font-bold tabular-nums" style={{ color: multiColor(championRow.bestMultiplier) }}>
                    {championRow.bestMultiplier.toFixed(2)}x
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isBattle ? (
          <>
            <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12] sm:grid-cols-4">
              {(
                [
                  ["Players", String(totals.participants), undefined],
                  ["Bought in", money(totals.totalBuyIn), ACCENTS.amber],
                  ["Paid out", money(totals.totalPaidOut), ACCENTS.green],
                  ["Matches played", `${totals.matchesPlayed}/${totals.matchesTotal}`, undefined],
                ] as [string, string, string | undefined][]
              ).map(([label, value, color], index) => (
                <div
                  key={label}
                  className={`px-5 py-4 sm:px-6 ${index % 2 === 1 ? "border-l border-white/[0.07]" : ""} ${
                    index >= 2 ? "border-t border-white/[0.07] sm:border-t-0" : ""
                  } ${index === 2 ? "sm:border-l" : ""}`}
                >
                  <dt>
                    <MonoLabel className="text-white/35">{label}</MonoLabel>
                  </dt>
                  <dd className="mt-1.5 text-[22px] font-bold tabular-nums" style={{ color: color ?? "#FFFFFF" }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12]">
              <PanelTitle icon={Swords} accent={ACCENTS.purple} title="Bracket" right={`${size} players`} />
              <div className="p-4 sm:p-5">
                <TournamentBracketBoard size={size} matches={matches} participants={participants} />
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12]">
              <PanelTitle icon={Trophy} accent={ACCENTS.amber} title="Standings" right="Best result per player" />
              <ol>
                {rows.map((row, index) => (
                  <li
                    key={row.participant.id}
                    className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-white/[0.05] px-5 py-3 last:border-b-0 sm:px-6 ${
                      row.eliminated ? "opacity-50" : ""
                    }`}
                  >
                    <span className="font-mono text-[12px] tabular-nums text-white/35">{String(index + 1).padStart(2, "0")}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      <SlotThumb src={row.participant.game_image_url} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          {row.participant.id === champion?.id && <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />}
                          <span className="truncate text-[14px] font-semibold text-white">{row.participant.username}</span>
                          {row.participant.is_super && (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-black"
                              style={{ backgroundColor: ACCENTS.amber }}
                            >
                              Super
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-white/40">{row.participant.game_name ?? "No slot"}</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[14px] font-semibold tabular-nums text-white/85">
                        {row.bestPayout === null ? "—" : money(row.bestPayout)}
                      </span>
                      {row.bestMultiplier !== null && (
                        <span className="text-[12.5px] font-bold tabular-nums" style={{ color: multiColor(row.bestMultiplier) }}>
                          {row.bestMultiplier.toFixed(2)}x
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        ) : legacySlots === null ? (
          <div className="h-40 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" />
        ) : legacySlots > 0 ? (
          // Pre-console tournament: the field only ever existed as named slots.
          <TournamentBracketView tournamentId={tournamentId} maxParticipants={meta?.max_participants ?? 0} />
        ) : (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6">
            <Swords className="h-6 w-6 shrink-0" style={{ color: ACCENTS.purple }} />
            <div>
              <p className="text-[15px] font-semibold text-white">The bracket has not been drawn yet</p>
              <p className="mt-0.5 text-[13px] text-white/45">It appears here once the field is set.</p>
            </div>
          </div>
        )}
      </PageBody>
    </div>
  )
}

/** The gold the site uses for a big win. */
const GOLD = "#F5C542"

function BackLink() {
  return (
    <Link
      href="/tournaments"
      className="group inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
    >
      <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
      All tournaments
    </Link>
  )
}

function PanelTitle({
  icon: Icon,
  accent,
  title,
  right,
}: {
  icon: typeof Swords
  accent: string
  title: string
  right?: string
}) {
  return (
    <header className="flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-4 sm:px-6">
      <Icon className="h-4 w-4" style={{ color: accent }} />
      <MonoLabel className="text-white/70">{title}</MonoLabel>
      {right && <span className="ml-auto text-[12.5px] text-white/40">{right}</span>}
    </header>
  )
}

function SlotThumb({ src }: { src: string | null }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-black/40">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- slot art from any provider host
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-white/20" />
      )}
    </span>
  )
}
