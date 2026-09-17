"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, Crown, Monitor, Play, Plus, RotateCcw, Trash2, Trophy, User, Users } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile } from "@/components/ui/panel"
import { SlotCombobox } from "@/components/admin/slot-combobox"
import { TournamentBracketBoard } from "@/components/tournament-bracket-board"
import { TournamentResultDialog } from "@/components/admin/tournament-result-dialog"
import { RecordWinDialog, WinnerName } from "@/components/admin/record-win-dialog"
import {
  BRACKET_SIZES,
  TOURNAMENT_CASINOS,
  advanceTo,
  buildBracket,
  decideMatch,
  money,
  roundCount,
  roundOnePairs,
  tournamentTotals,
  type BracketSize,
  type Match,
  type Participant,
} from "@/lib/tournament"

/**
 * The tournament console.
 *
 * One page for the whole run — pick the size, add the players, start, then
 * enter payouts round by round — because that is how it is actually operated:
 * live, on stream, with the bracket on screen. The previous version was a CRUD
 * form that created a row and then sent you to three more pages to fill in.
 *
 * Only tournaments with tournament_type = 'battle' belong to this console. The
 * older bracket/points/leaderboard rows share the table but not the model, and
 * are left alone rather than half-migrated into a shape they do not fit.
 */

const BATTLE = "battle"

type Tournament = {
  id: string
  title: string
  bracket_size: number | null
  bracket_status: string | null
  started_at: string | null
  finished_at: string | null
  champion_participant_id: string | null
  winner_username: string | null
  created_at: string
}

const emptyForm = {
  username: "",
  buy_amount: "",
  casino: TOURNAMENT_CASINOS[0] as string,
  game_name: "",
  game_provider: null as string | null,
  is_super: false,
}

export default function AdminTournamentsPage() {
  const supabaseRef = useRef(createBrowserClient())
  const supabase = supabaseRef.current

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [history, setHistory] = useState<Tournament[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [size, setSize] = useState<BracketSize>(8)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null)
  const [resultMatch, setResultMatch] = useState<Match | null>(null)
  const [showObs, setShowObs] = useState(false)
  const [championSeen, setChampionSeen] = useState(false)
  // Clicking the champion opens the win log against their name.
  const [logWinner, setLogWinner] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: battles, error } = await supabase
      .from("tournaments")
      .select(
        "id, title, bracket_size, bracket_status, started_at, finished_at, champion_participant_id, winner_username, created_at",
      )
      .eq("tournament_type", BATTLE)
      .order("created_at", { ascending: false })
      .limit(25)

    if (error) {
      console.error("[v0] Could not load tournaments:", error)
      setNotice({ tone: "error", text: "Could not load tournaments." })
      setLoading(false)
      return
    }

    const rows = (battles ?? []) as Tournament[]
    const active = rows.find((row) => row.bracket_status !== "finished") ?? null
    setTournament(active)
    setHistory(rows.filter((row) => row.bracket_status === "finished"))

    if (!active) {
      setParticipants([])
      setMatches([])
      setLoading(false)
      return
    }

    if (active.bracket_size) setSize(active.bracket_size as BracketSize)

    const [{ data: people }, { data: games }] = await Promise.all([
      supabase
        .from("tournament_participants")
        .select("id, username, buy_amount, casino, game_name, game_image_url, is_super, seed, joined_at")
        .eq("tournament_id", active.id)
        .order("joined_at"),
      supabase
        .from("tournament_matches")
        .select("id, round_number, match_number, p1_id, p2_id, p1_payout, p2_payout, winner_participant_id")
        .eq("tournament_id", active.id)
        .order("round_number")
        .order("match_number"),
    ])

    setParticipants((people ?? []) as Participant[])
    setMatches((games ?? []) as Match[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const status = tournament?.bracket_status ?? "registration"
  const registering = status === "registration"
  const totals = useMemo(() => tournamentTotals(participants, matches, size), [participants, matches, size])
  const champion = tournament?.champion_participant_id
    ? participants.find((participant) => participant.id === tournament.champion_participant_id) ?? null
    : null

  // Any casino already used stays selectable even if it is not in the list.
  const casinoOptions = useMemo(() => {
    const seen = new Set<string>(TOURNAMENT_CASINOS)
    for (const participant of participants) if (participant.casino) seen.add(participant.casino)
    if (form.casino) seen.add(form.casino)
    return Array.from(seen)
  }, [participants, form.casino])

  /** Creates the tournament row the first time it is actually needed. */
  async function ensureTournament(): Promise<Tournament | null> {
    if (tournament) return tournament
    const now = new Date()
    const stamp = now.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        title: "Bonus Battle — " + stamp,
        tournament_type: BATTLE,
        status: "active",
        bracket_size: size,
        bracket_status: "registration",
        max_participants: size,
        prize_pool: 0,
        entry_fee: 0,
        start_date: now.toISOString(),
        // end_date is NOT NULL on the table and means nothing for a battle,
        // which ends when the final is played. A month out keeps it clear of
        // anything that filters on it.
        end_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select(
        "id, title, bracket_size, bracket_status, started_at, finished_at, champion_participant_id, winner_username, created_at",
      )
      .single()

    if (error || !data) {
      console.error("[v0] Could not create tournament:", error)
      setNotice({ tone: "error", text: "Could not create the tournament." })
      return null
    }
    setTournament(data as Tournament)
    return data as Tournament
  }

  async function chooseSize(next: BracketSize) {
    if (!registering) return
    if (participants.length > next) {
      const excess = participants.length - next
      setNotice({
        tone: "error",
        text: participants.length + " players are already in — remove " + excess + " before dropping to " + next + ".",
      })
      return
    }
    setNotice(null)
    setSize(next)
    if (tournament) {
      const { error } = await supabase
        .from("tournaments")
        .update({ bracket_size: next, max_participants: next })
        .eq("id", tournament.id)
      if (error) console.error("[v0] Could not change bracket size:", error)
      else setTournament({ ...tournament, bracket_size: next })
    }
  }

  async function addParticipant(event: React.FormEvent) {
    event.preventDefault()
    const username = form.username.trim()
    if (!username) return
    if (participants.length >= size) {
      setNotice({ tone: "error", text: "The bracket is full at " + size + " players." })
      return
    }

    setBusy("add")
    const active = await ensureTournament()
    if (!active) {
      setBusy(null)
      return
    }

    // The bracket overlay shows a slot thumbnail. There is no image in the
    // slots catalogue, but the same game has usually been hunted before with a
    // picture attached, so the most recent one is reused. A miss just leaves
    // the neutral tile.
    const gameName = form.game_name.trim()
    let gameImage: string | null = null
    if (gameName) {
      const { data: seen } = await supabase
        .from("hunt_bonuses")
        .select("image_url")
        .eq("game_name", gameName)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      gameImage = seen?.image_url ?? null
    }

    const { data, error } = await supabase
      .from("tournament_participants")
      .insert({
        tournament_id: active.id,
        username,
        buy_amount: Number.parseFloat(form.buy_amount) || 0,
        casino: form.casino || null,
        game_name: gameName || null,
        game_provider: form.game_provider,
        game_image_url: gameImage,
        is_super: form.is_super,
      })
      .select("id, username, buy_amount, casino, game_name, game_image_url, is_super, seed, joined_at")
      .single()

    setBusy(null)

    if (error) {
      // The table carries UNIQUE(tournament_id, username); say so plainly
      // rather than surfacing "23505".
      const duplicate = (error as { code?: string }).code === "23505"
      console.error("[v0] Could not add participant:", error)
      setNotice({
        tone: "error",
        text: duplicate ? username + " is already in this tournament." : "Could not add that player.",
      })
      return
    }

    setNotice(null)
    const nextParticipants = [...participants, data as Participant]
    setParticipants(nextParticipants)
    await syncPlayerCount(active.id, nextParticipants.length)
    // The casino carries over: a battle usually runs on one.
    setForm({ ...emptyForm, casino: form.casino })
  }

  async function removeParticipant(id: string) {
    const { error } = await supabase.from("tournament_participants").delete().eq("id", id)
    if (error) {
      console.error("[v0] Could not remove participant:", error)
      return
    }
    const remaining = participants.filter((participant) => participant.id !== id)
    setParticipants(remaining)
    if (tournament) await syncPlayerCount(tournament.id, remaining.length)
  }

  /**
   * The public tournaments page reads current_participants rather than counting
   * participant rows, so it has to be written here. Not fatal if it fails — the
   * count is a display figure, and the bracket is built from the rows.
   */
  async function syncPlayerCount(tournamentId: string, players: number) {
    const { error } = await supabase
      .from("tournaments")
      .update({ current_participants: players })
      .eq("id", tournamentId)
    if (error) console.error("[v0] Could not update the player count:", error)
  }

  async function startTournament() {
    if (!tournament || participants.length !== size) return
    setBusy("start")

    // Seeded by the order they were entered: that is the running order the host
    // already has, and nothing on this page claims to rank them.
    const seeded = participants.map((participant, index) => ({ ...participant, seed: index + 1 }))
    for (const participant of seeded) {
      const { error } = await supabase
        .from("tournament_participants")
        .update({ seed: participant.seed })
        .eq("id", participant.id)
      if (error) console.error("[v0] Could not seed participant:", participant.id, error)
    }

    const bySeed = new Map(seeded.map((participant) => [participant.seed as number, participant]))
    const firstRound = new Map(roundOnePairs(size, bySeed).map((pair) => [pair.match_number, pair]))

    const rows = buildBracket(size).map((match) => {
      const pair = match.round_number === 1 ? firstRound.get(match.match_number) : undefined
      return {
        tournament_id: tournament.id,
        round_number: match.round_number,
        match_number: match.match_number,
        status: "pending",
        p1_id: pair?.p1?.id ?? null,
        p2_id: pair?.p2?.id ?? null,
      }
    })

    const { error: matchError } = await supabase.from("tournament_matches").insert(rows)
    if (matchError) {
      console.error("[v0] Could not build the bracket:", matchError)
      setNotice({ tone: "error", text: "Could not build the bracket." })
      setBusy(null)
      return
    }

    const { error } = await supabase
      .from("tournaments")
      .update({ bracket_status: "running", started_at: new Date().toISOString() })
      .eq("id", tournament.id)
    if (error) console.error("[v0] Could not start the tournament:", error)

    setBusy(null)
    setChampionSeen(false)
    await load()
  }

  async function saveResult(match: Match, p1Payout: number, p2Payout: number) {
    if (!tournament) return
    const outcome = decideMatch(p1Payout, p2Payout)
    if (outcome.winner === null) return

    setBusy("result")
    const winnerId = outcome.winner === 1 ? match.p1_id : match.p2_id
    const total = roundCount(size)

    const { error } = await supabase
      .from("tournament_matches")
      .update({
        p1_payout: p1Payout,
        p2_payout: p2Payout,
        winner_participant_id: winnerId,
        played_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", match.id)
    if (error) console.error("[v0] Could not save the result:", error)

    // Re-entering the same winner with different numbers is a correction, not a
    // new outcome — leave the rest of the bracket alone. A different winner
    // invalidates everything downstream, so that chain is wiped rather than
    // left pointing at someone who is no longer in it.
    const winnerChanged = match.winner_participant_id !== winnerId

    if (winnerChanged) {
      let from = { round: match.round_number, matchNumber: match.match_number }
      let carry: string | null = winnerId
      while (from.round < total) {
        const next = advanceTo(from.round, from.matchNumber)
        const target = matches.find(
          (candidate) => candidate.round_number === next.round && candidate.match_number === next.matchNumber,
        )
        if (!target) break
        const patch: Record<string, unknown> = {
          p1_payout: null,
          p2_payout: null,
          winner_participant_id: null,
          played_at: null,
          status: "pending",
        }
        patch[next.slot === 1 ? "p1_id" : "p2_id"] = carry
        const { error: nextError } = await supabase.from("tournament_matches").update(patch).eq("id", target.id)
        if (nextError) console.error("[v0] Could not advance the winner:", nextError)
        from = { round: next.round, matchNumber: next.matchNumber }
        // Only the match immediately after receives the winner; the ones beyond
        // it lose their entrant until that match is played again.
        carry = null
      }
    }

    const winner = participants.find((participant) => participant.id === winnerId) ?? null

    if (match.round_number === total) {
      const { error: crownError } = await supabase
        .from("tournaments")
        .update({
          champion_participant_id: winnerId,
          winner_username: winner?.username ?? null,
          bracket_status: "finished",
          finished_at: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", tournament.id)
      if (crownError) console.error("[v0] Could not record the champion:", crownError)
      setChampionSeen(false)
    } else if (winnerChanged && tournament.bracket_status === "finished") {
      // An earlier round was corrected after the final had been played, so the
      // champion no longer follows from the bracket.
      const { error: undoError } = await supabase
        .from("tournaments")
        .update({
          champion_participant_id: null,
          winner_username: null,
          bracket_status: "running",
          finished_at: null,
          status: "active",
        })
        .eq("id", tournament.id)
      if (undoError) console.error("[v0] Could not reopen the tournament:", undoError)
    }

    setBusy(null)
    setResultMatch(null)
    await load()
  }

  async function resetAll() {
    if (!tournament) return
    if (!confirm("Remove every player and clear the bracket? The tournament goes back to registration.")) return
    setBusy("reset")
    await supabase.from("tournament_matches").delete().eq("tournament_id", tournament.id)
    await supabase.from("tournament_participants").delete().eq("tournament_id", tournament.id)
    await supabase
      .from("tournaments")
      .update({
        current_participants: 0,
        bracket_status: "registration",
        started_at: null,
        finished_at: null,
        champion_participant_id: null,
        winner_username: null,
        status: "active",
      })
      .eq("id", tournament.id)
    setBusy(null)
    setNotice(null)
    await load()
  }

  async function newTournament() {
    if (tournament && !confirm("Archive the current tournament and start a new one?")) return
    if (tournament) {
      await supabase
        .from("tournaments")
        .update({ bracket_status: "finished", status: "completed" })
        .eq("id", tournament.id)
    }
    setTournament(null)
    setParticipants([])
    setMatches([])
    setChampionSeen(false)
    await load()
  }

  const dialogP1 = resultMatch ? participants.find((entry) => entry.id === resultMatch.p1_id) ?? null : null
  const dialogP2 = resultMatch ? participants.find((entry) => entry.id === resultMatch.p2_id) ?? null : null

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Tournament</h1>
          <p className="mt-1 text-[13px] text-white/40">
            {tournament ? tournament.title : "Nothing running — adding the first player starts a new one."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowObs((current) => !current)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <Monitor className="h-3.5 w-3.5" />
            OBS widgets
          </button>
          <button
            type="button"
            onClick={resetAll}
            disabled={!tournament || busy === "reset"}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-[#E5484D]/40 hover:text-[#E5484D] disabled:opacity-30"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset all
          </button>
        </div>
      </header>

      {showObs && <ObsLinks onClose={() => setShowObs(false)} />}

      {notice && (
        <Panel
          accent={notice.tone === "error" ? "red" : "blue"}
          className="px-3.5 py-2.5 text-[13px]"
          style={{ color: notice.tone === "error" ? ACCENTS.red : ACCENTS.blue }}
        >
          {notice.text}
        </Panel>
      )}

      {loading ? (
        <Panel className="py-16 text-center">
          <MonoLabel className="text-white/25">Loading</MonoLabel>
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <Panel accent="blue">
                <PanelHeader title="Tournament size" />
                <div className="grid grid-cols-4 gap-2 p-3">
                  {BRACKET_SIZES.map((option) => {
                    const selected = size === option
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={!registering}
                        onClick={() => chooseSize(option)}
                        className="rounded-md border py-2.5 text-center transition disabled:cursor-not-allowed disabled:opacity-40"
                        style={
                          selected
                            ? { borderColor: ACCENTS.blue + "77", backgroundColor: ACCENTS.blue + "1f" }
                            : { borderColor: "rgba(255,255,255,0.08)" }
                        }
                      >
                        <span
                          className="block text-[17px] font-semibold leading-none tabular-nums"
                          style={{ color: selected ? ACCENTS.blue : "#E7E7EA" }}
                        >
                          {option}
                        </span>
                        <MonoLabel className="mt-1.5 block text-white/30">Players</MonoLabel>
                      </button>
                    )
                  })}
                </div>
              </Panel>

              <Panel accent="green">
                <PanelHeader
                  title="Add participant"
                  accent="green"
                  right={<MonoLabel className="text-white/30">{participants.length}/{size}</MonoLabel>}
                />
                {registering ? (
                  <form onSubmit={addParticipant} className="space-y-3 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Username" htmlFor="username">
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                          <input
                            id="username"
                            value={form.username}
                            onChange={(event) => setForm({ ...form, username: event.target.value })}
                            placeholder="Username"
                            className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                          />
                        </div>
                      </Field>

                      <Field label="Buy amount" htmlFor="buy_amount">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-white/30">$</span>
                          <input
                            id="buy_amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.buy_amount}
                            onChange={(event) => setForm({ ...form, buy_amount: event.target.value })}
                            placeholder="0.00"
                            className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 pl-7 pr-3 text-[13px] tabular-nums text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
                          />
                        </div>
                      </Field>

                      <Field label="Casino" htmlFor="casino">
                        <select
                          id="casino"
                          value={form.casino}
                          onChange={(event) => setForm({ ...form, casino: event.target.value })}
                          className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition focus:border-white/25"
                        >
                          {casinoOptions.map((casino) => (
                            <option key={casino} value={casino} className="bg-[#121216]">
                              {casino}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Game / slot" htmlFor="game_name">
                        <SlotCombobox
                          id="game_name"
                          value={form.game_name}
                          onChange={(game_name, game_provider) =>
                            setForm((current) => ({ ...current, game_name, game_provider }))
                          }
                        />
                      </Field>
                    </div>

                    <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-white/60">
                      <input
                        type="checkbox"
                        checked={form.is_super}
                        onChange={(event) => setForm({ ...form, is_super: event.target.checked })}
                        className="h-3.5 w-3.5 accent-[#E8A33D]"
                      />
                      Super
                    </label>

                    <button
                      type="submit"
                      disabled={busy === "add" || participants.length >= size || !form.username.trim()}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
                      style={{ backgroundColor: ACCENTS.green }}
                    >
                      <Plus className="h-4 w-4" />
                      {busy === "add" ? "Adding…" : "Add participant"}
                    </button>
                  </form>
                ) : (
                  <p className="p-3 text-[13px] text-white/35">
                    Registration is closed — the bracket is {status === "finished" ? "finished" : "running"}.
                  </p>
                )}
              </Panel>

              {registering ? (
                <button
                  type="button"
                  onClick={startTournament}
                  disabled={participants.length !== size || busy === "start"}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border font-mono text-[11px] uppercase tracking-[0.12em] transition disabled:cursor-not-allowed"
                  style={
                    participants.length === size
                      ? { backgroundColor: ACCENTS.blue, borderColor: ACCENTS.blue, color: "#0B0B0D" }
                      : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }
                  }
                >
                  <Play className="h-4 w-4" />
                  {busy === "start"
                    ? "Starting…"
                    : participants.length === size
                      ? "Start tournament"
                      : size - participants.length + " more to start"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={newTournament}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.10] font-mono text-[11px] uppercase tracking-[0.12em] text-white/50 transition hover:border-white/25 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  New tournament
                </button>
              )}
            </div>

            <Panel accent="amber" className="flex flex-col">
              <PanelHeader
                title="Participants"
                accent="amber"
                right={<MonoLabel className="text-white/30">{money(totals.totalBuyIn)} bought in</MonoLabel>}
              />

              {participants.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
                  <Users className="h-8 w-8 text-white/10" />
                  <p className="text-[13px] text-white/30">No participants yet</p>
                  <MonoLabel className="text-white/20">Add {size} players to start</MonoLabel>
                </div>
              ) : (
                <ul className="flex-1 divide-y divide-white/[0.05]">
                  {participants.map((participant, index) => (
                    <li key={participant.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-white/20">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-[13px] font-medium text-white">{participant.username}</span>
                          {participant.is_super && <MonoLabel style={{ color: ACCENTS.amber }}>Super</MonoLabel>}
                        </div>
                        <p className="truncate text-[11px] text-white/30">
                          {participant.game_name ?? "No slot"}
                          {participant.casino ? " · " + participant.casino : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] tabular-nums text-white/60">
                        {money(participant.buy_amount)}
                      </span>
                      {registering && (
                        <button
                          type="button"
                          onClick={() => removeParticipant(participant.id)}
                          aria-label={"Remove " + participant.username}
                          className="shrink-0 rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-white/[0.08] px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <MonoLabel className="text-white/30">Registration progress</MonoLabel>
                  <MonoLabel style={{ color: ACCENTS.amber }}>
                    {Math.round((participants.length / size) * 100)}%
                  </MonoLabel>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: Math.min(100, (participants.length / size) * 100) + "%",
                      backgroundColor: ACCENTS.amber,
                    }}
                  />
                </div>
              </div>
            </Panel>
          </div>

          {matches.length > 0 && (
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

              <Panel accent="purple">
                <PanelHeader
                  title="Bracket"
                  accent="purple"
                  right={
                    champion ? (
                      <WinnerName
                        username={champion.username}
                        onClick={() => setLogWinner(champion.username)}
                        className="font-mono text-[10px] uppercase leading-none tracking-[0.12em]"
                      >
                        <span style={{ color: ACCENTS.green }}>Champion · {champion.username}</span>
                      </WinnerName>
                    ) : null
                  }
                />
                <div className="p-3">
                  <TournamentBracketBoard
                    size={size}
                    matches={matches}
                    participants={participants}
                    onEnterResult={setResultMatch}
                  />
                </div>
              </Panel>
            </>
          )}

          {history.length > 0 && (
            <Panel>
              <PanelHeader title="Previous tournaments" accent="slate" />
              <ul className="divide-y divide-white/[0.05]">
                {history.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-white/15" />
                    <span className="truncate text-white/70">{row.title}</span>
                    <span className="ml-auto shrink-0 text-white/30">{row.winner_username ?? "No champion"}</span>
                    <MonoLabel className="w-24 shrink-0 text-right text-white/20">
                      {new Date(row.finished_at ?? row.created_at).toLocaleDateString()}
                    </MonoLabel>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {resultMatch && dialogP1 && dialogP2 && (
        <TournamentResultDialog
          match={resultMatch}
          p1={dialogP1}
          p2={dialogP2}
          saving={busy === "result"}
          onSave={(p1Payout, p2Payout) => saveResult(resultMatch, p1Payout, p2Payout)}
          onClose={() => setResultMatch(null)}
        />
      )}

      {champion && !championSeen && (
        <ChampionDialog
          champion={champion}
          totals={totals}
          onClose={() => setChampionSeen(true)}
          onRecordWin={() => {
            setChampionSeen(true)
            setLogWinner(champion.username)
          }}
        />
      )}

      {logWinner && (
        <RecordWinDialog
          username={logWinner}
          source="tournament"
          sourceRef={tournament?.title}
          onClose={() => setLogWinner(null)}
        />
      )}
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor}>
        <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>
      </label>
      {children}
    </div>
  )
}

/** The two browser-source URLs, copyable — OBS needs the absolute address. */
function ObsLinks({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const origin = typeof window === "undefined" ? "" : window.location.origin
  const widgets = [
    { path: "/obs/tournament/overview", label: "Bracket", hint: "Every round, every result — wide source" },
    { path: "/obs/tournament/round", label: "Current match", hint: "Who is opening right now — small source" },
  ]

  return (
    <Panel accent="blue">
      <PanelHeader
        title="OBS browser sources"
        right={
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/30 transition hover:text-white"
          >
            Hide
          </button>
        }
      />
      <ul className="divide-y divide-white/[0.05]">
        {widgets.map((widget) => {
          const url = origin + widget.path
          const isCopied = copied === widget.path
          return (
            <li key={widget.path} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12px] text-white/70">{url}</p>
                <p className="text-[11px] text-white/25">
                  {widget.label} — {widget.hint}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url)
                    setCopied(widget.path)
                    setTimeout(() => setCopied(null), 1200)
                  } catch {
                    // Clipboard can be blocked; the URL is on screen either way.
                  }
                }}
                className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-white/[0.10] px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
              >
                {isCopied ? <Check className="h-3 w-3" style={{ color: ACCENTS.green }} /> : <Copy className="h-3 w-3" />}
                {isCopied ? "Copied" : "Copy"}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-white/[0.05] px-3.5 py-2 text-[11px] text-white/25">
        Neither is required: while a battle is running, the stream column at /obs/stream already carries
        the current match and the round&rsquo;s results.
      </p>
    </Panel>
  )
}

function ChampionDialog({
  champion,
  totals,
  onClose,
  onRecordWin,
}: {
  champion: Participant
  totals: ReturnType<typeof tournamentTotals>
  onClose: () => void
  onRecordWin: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Champion"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border bg-[#0E0E11] text-center"
        style={{ borderColor: ACCENTS.amber + "44" }}
      >
        <div className="px-6 py-8">
          <Crown className="mx-auto h-9 w-9" style={{ color: ACCENTS.amber }} />
          <MonoLabel className="mt-4 block text-white/35">Champion</MonoLabel>
          <p className="mt-2 text-[24px] font-semibold leading-tight text-white">{champion.username}</p>
          <p className="mt-1 text-[13px] text-white/35">{champion.game_name ?? "No slot recorded"}</p>

          <div className="mt-6 grid grid-cols-2 gap-2 text-left">
            <div className="rounded-md border border-white/[0.08] px-3 py-2.5">
              <MonoLabel className="block text-white/30">Bought in</MonoLabel>
              <p className="mt-1 text-[15px] tabular-nums text-white">{money(totals.totalBuyIn)}</p>
            </div>
            <div className="rounded-md border border-white/[0.08] px-3 py-2.5">
              <MonoLabel className="block text-white/30">Paid out</MonoLabel>
              <p className="mt-1 text-[15px] tabular-nums" style={{ color: ACCENTS.green }}>
                {money(totals.totalPaidOut)}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/50 transition hover:bg-white/[0.05] hover:text-white"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRecordWin}
            className="border-l border-white/[0.08] py-3 font-mono text-[11px] uppercase tracking-[0.12em] transition hover:bg-white/[0.05]"
            style={{ color: ACCENTS.amber }}
          >
            Record the win
          </button>
        </div>
      </div>
    </div>
  )
}
