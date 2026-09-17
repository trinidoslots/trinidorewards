"use client"

import { Check, Trophy } from "lucide-react"
import { money, multiplier, type Match, type Participant } from "@/lib/tournament"
import { OBS } from "@/lib/obs-theme"

/**
 * Bracket pieces for the OBS sources.
 *
 * Their own palette rather than the shared OBS one: these sit on a scene as a
 * bracket, where green-for-winner and a violet spine carry the reading at a
 * glance, and the blue event-column colours would flatten that out.
 */
export const BRACKET = {
  card: "#131316",
  cardBorder: "#2A2A2F",
  header: "#0F0F12",
  spine: "#A855F7",
  win: "#22C55E",
  winFill: "rgba(34, 197, 94, 0.10)",
  winBorder: "rgba(34, 197, 94, 0.45)",
  gold: "#E0A82E",
  goldFill: "rgba(224, 168, 46, 0.07)",
  goldBorder: "rgba(224, 168, 46, 0.45)",
  text: "#E9E9EC",
  muted: "#6E6E78",
  seedIdle: "#232329",
} as const

// Widened off the literal types `as const` gives BRACKET, so a second palette
// can supply different values for the same keys.
export type BracketPalette = Record<keyof typeof BRACKET, string>

/**
 * The same pieces in the stream column's colours.
 *
 * The bracket sources are their own scene element and can carry violet and
 * gold; inside the event column the card has to read as one of the tiles, so it
 * borrows the shared OBS palette and drops the accents that are not in it.
 */
export const STREAM_BRACKET: BracketPalette = {
  card: "rgba(255, 255, 255, 0.035)",
  cardBorder: OBS.cardBorder,
  header: "transparent",
  spine: OBS.label,
  win: OBS.cashout,
  winFill: "rgba(52, 211, 153, 0.10)",
  winBorder: "rgba(52, 211, 153, 0.35)",
  // No gold in the column's palette — a champion is green like any good result.
  gold: OBS.cashout,
  goldFill: "rgba(52, 211, 153, 0.10)",
  goldBorder: "rgba(52, 211, 153, 0.35)",
  text: OBS.value,
  muted: OBS.muted,
  seedIdle: "rgba(255, 255, 255, 0.09)",
}

/** The little square a slot thumbnail sits in. Grey tile when there is none. */
function Thumb({
  participant,
  size = 30,
  palette = BRACKET,
}: {
  participant: Participant
  size?: number
  palette?: BracketPalette
}) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded"
      style={{ width: size, height: size * 0.82, backgroundColor: palette.seedIdle }}
    >
      {participant.game_image_url && (
        <img
          src={participant.game_image_url}
          alt=""
          className="h-full w-full object-cover"
          onError={(event) => {
            // A dead thumbnail must not leave a broken-image glyph on stream.
            event.currentTarget.style.display = "none"
          }}
        />
      )}
    </span>
  )
}

function SeedBadge({
  seed,
  won,
  gold,
  palette = BRACKET,
}: {
  seed: number | null
  won: boolean
  gold?: boolean
  palette?: BracketPalette
}) {
  const accent = gold ? palette.gold : palette.win
  return (
    <span
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[11px] font-bold tabular-nums"
      style={
        won
          ? { backgroundColor: accent, color: "#0B0B0D" }
          : { backgroundColor: palette.seedIdle, color: palette.muted }
      }
    >
      {seed ?? "-"}
    </span>
  )
}

/** One side of a match, as it appears inside the bracket. */
function PlayerRow({
  participant,
  payout,
  won,
  decided,
  gold,
}: {
  participant: Participant | null
  payout: number | null
  won: boolean
  decided: boolean
  gold?: boolean
}) {
  const accent = gold ? BRACKET.gold : BRACKET.win

  if (!participant) {
    return (
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="h-[22px] w-[22px] shrink-0 rounded" style={{ backgroundColor: BRACKET.seedIdle }} />
        <span className="text-[12px]" style={{ color: BRACKET.muted }}>
          Awaiting winner
        </span>
      </div>
    )
  }

  const times = multiplier(payout === null ? null : Number(payout), Number(participant.buy_amount))
  const result = times === null ? "-" : times.toFixed(2) + "x"

  return (
    <div
      className="flex items-center gap-2 px-2 py-2"
      style={{
        backgroundColor: won ? (gold ? BRACKET.goldFill : BRACKET.winFill) : "transparent",
        // Losing sides fade back rather than disappear — the audience still
        // wants to see what the beaten slot actually paid.
        opacity: decided && !won ? 0.45 : 1,
      }}
    >
      <SeedBadge seed={participant.seed} won={won} gold={gold} />
      <Thumb participant={participant} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold leading-tight" style={{ color: BRACKET.text }}>
          {participant.username}
        </p>
        <p className="truncate text-[11px] leading-tight" style={{ color: won ? accent : BRACKET.muted }}>
          {payout === null
            ? participant.game_name ?? "No slot"
            : result + " (" + money(Number(payout)) + ")"}
        </p>
      </div>
      {won && <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />}
    </div>
  )
}

/** A match in the bracket: header, both sides, and the decided tick between. */
export function BracketMatchCard({
  match,
  p1,
  p2,
  gold,
}: {
  match: Match
  p1: Participant | null
  p2: Participant | null
  gold?: boolean
}) {
  const decided = !!match.winner_participant_id
  const accent = gold ? BRACKET.gold : BRACKET.win

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{
        backgroundColor: gold && decided ? BRACKET.goldFill : BRACKET.card,
        border: "1px solid " + (decided ? (gold ? BRACKET.goldBorder : BRACKET.winBorder) : BRACKET.cardBorder),
      }}
    >
      <header
        className="flex items-center px-2 py-1.5"
        style={{ backgroundColor: BRACKET.header, borderBottom: "1px solid " + BRACKET.cardBorder }}
      >
        <span className="text-[11px]" style={{ color: BRACKET.muted }}>
          Match {match.match_number}
        </span>
        {decided && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium" style={{ color: accent }}>
            <Check className="h-3 w-3" />
            Done
          </span>
        )}
      </header>

      <PlayerRow
        participant={p1}
        payout={match.p1_payout}
        won={!!p1 && match.winner_participant_id === p1.id}
        decided={decided}
        gold={gold}
      />
      <div className="h-px" style={{ backgroundColor: BRACKET.cardBorder }} />
      <PlayerRow
        participant={p2}
        payout={match.p2_payout}
        won={!!p2 && match.winner_participant_id === p2.id}
        decided={decided}
        gold={gold}
      />

      {decided && (
        <span
          className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ backgroundColor: accent }}
        >
          <Check className="h-3 w-3" style={{ color: "#0B0B0D" }} strokeWidth={3} />
        </span>
      )}
    </div>
  )
}

function UpNext({
  participant,
  palette,
}: {
  participant: Participant | null
  palette: BracketPalette
}) {
  if (!participant) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="h-[22px] w-[22px] shrink-0 rounded" style={{ backgroundColor: palette.seedIdle }} />
        <span className="text-[12px]" style={{ color: palette.muted }}>
          Awaiting winner
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <SeedBadge seed={participant.seed} won={false} palette={palette} />
      <Thumb participant={participant} palette={palette} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold leading-tight" style={{ color: palette.text }}>
          {participant.username}
        </p>
        <p className="truncate text-[11px] leading-tight" style={{ color: palette.muted }}>
          {participant.game_name ?? "No slot"}
        </p>
      </div>
    </div>
  )
}

/**
 * The single-match card for the round source and the event feed: who is up,
 * with a VS pill between them. No payouts — this is the "now opening" card, and
 * the numbers belong on the bracket.
 */
export function RoundMatchCard({
  match,
  p1,
  p2,
  palette = BRACKET,
}: {
  match: Match
  p1: Participant | null
  p2: Participant | null
  palette?: BracketPalette
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{
        backgroundColor: palette.card,
        border: "1px solid " + palette.cardBorder,
        borderLeft: "2px solid " + palette.spine,
      }}
    >
      <header className="px-2.5 pb-0.5 pt-1.5">
        <span className="text-[11px]" style={{ color: palette.muted }}>
          Match {match.match_number}
        </span>
      </header>

      {/* The pill is positioned against the two rows, not the card, so the
          header height cannot push it off the seam between them. */}
      <div className="relative">
        <UpNext participant={p1} palette={palette} />
        <UpNext participant={p2} palette={palette} />
        <span
          className="absolute right-6 top-1/2 flex h-[22px] -translate-y-1/2 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: palette.seedIdle, color: palette.text }}
        >
          vs
        </span>
      </div>
    </div>
  )
}
