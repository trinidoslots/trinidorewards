"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { GiveawayCard, isGiveawayActive, useGiveawayState } from "@/components/obs/giveaway-card"
import {
  BannerRotator,
  EventDivider,
  PredictionEventCard,
  TransactionEventCard,
  usePredictionWindow,
  useTransactionEvents,
  type TransactionEvent,
} from "@/components/obs/stream-event-feed"
import { TournamentEventCard, useTournamentEvent } from "@/components/obs/tournament-event-card"
import { KickChatFeed } from "@/components/kick-chat-feed"
import { useKickChat } from "@/hooks/use-kick-chat"
import type { KickMessage } from "@/lib/kick-chat"
import { OBS, OBS_RADIUS } from "@/lib/obs-theme"
import { PREVIEW_TOURNAMENT } from "@/lib/tournament-preview"

const DEFAULT_SLUG = "trinidoslots"

// ?preview=1 renders one of each event card so the source can be positioned and
// restyled without waiting for a real deposit to land.
const PREVIEW_EVENTS: TransactionEvent[] = [
  { id: "preview-cashout", kind: "cashout", amount: 1_700_000, created_at: new Date().toISOString() },
  { id: "preview-deposit", kind: "deposit", amount: 25_000, created_at: new Date().toISOString() },
]

const PREVIEW_MESSAGES: KickMessage[] = [
  { username: "Lintai", content: "[emote:1730752:pepeJAM]", color: "#4FD1A5", badges: [] },
  {
    username: "Mcmonstermodd",
    content: "[emote:39262:KEKW] that hit",
    color: "#E8437D",
    badges: [{ type: "subscriber", count: 25 }],
  },
  {
    username: "S2GBlackeagles",
    content: "bonus buy when",
    color: "#53FC18",
    badges: [{ type: "subscriber", count: 34 }],
  },
  { username: "zaini160610", content: "ads", color: "#F5A623", badges: [{ type: "subscriber", count: 23 }] },
  { username: "Puffhuffle", content: "[emote:37232:monkaS]", color: "#9BB0FF", badges: [] },
  {
    username: "coyote18",
    content: "LETS GO",
    color: "#00C7FF",
    badges: [{ type: "moderator" }, { type: "subscriber", count: 43 }],
  },
  { username: "1suta65hz", content: "[emote:1730752:pepeJAM]", color: "#4C8BF5", badges: [{ type: "subscriber", count: 30 }] },
  { username: "Bonna89", content: "YUCK", color: "#E8437D", badges: [] },
].map((message, index) => ({
  ...message,
  id: `preview-${index}`,
  isMod: message.badges.some((badge) => badge.type === "moderator"),
  receivedAt: Date.now(),
}))

/**
 * The combined stream widget: live events on top, Kick chat filling the rest.
 *
 * Sized to fill whatever the OBS browser source is set to (a narrow vertical
 * column, ~340px wide, is what this is laid out for) rather than a fixed box,
 * so the chat grows into the height available instead of being clipped.
 *
 * Override the channel with ?channel=<slug>.
 */
function StreamWidget() {
  const searchParams = useSearchParams()
  const slug = searchParams.get("channel")?.trim() || DEFAULT_SLUG

  const isPreview = searchParams.get("preview") === "1"

  const prediction = usePredictionWindow()
  const giveaway = useGiveawayState()
  const liveTransactions = useTransactionEvents()
  const liveTournament = useTournamentEvent({ enabled: !isPreview })
  const { messages } = useKickChat({ slug })

  const transactions = isPreview ? PREVIEW_EVENTS : liveTransactions
  // In preview the countdown is faked so the card can be positioned off-stream.
  const predictionSeconds = prediction?.secondsLeft ?? (isPreview ? 287 : 0)
  const chatMessages = isPreview && messages.length === 0 ? PREVIEW_MESSAGES : messages
  const giveawayVisible = isGiveawayActive(giveaway)

  // While a battle is running the bracket rides in the column, so the dedicated
  // tournament sources do not have to sit on the scene the whole stream.
  const tournament = isPreview
    ? { ...PREVIEW_TOURNAMENT, visible: true, startedAt: Date.now() - 4 * 60_000 }
    : liveTournament

  // One list, ordered by when each event started, so whatever happened most
  // recently is at the top regardless of what kind of event it is.
  const events: { key: string; startedAt: number; node: React.ReactNode }[] = []

  // Parse helper: an unparseable or missing timestamp must not silently become
  // NaN (which sorts unpredictably) or 0 (which pins the card to the bottom).
  const startedAtOr = (value: string | null | undefined, fallback: number) => {
    const parsed = value ? Date.parse(value) : NaN
    return Number.isFinite(parsed) ? parsed : fallback
  }

  if (giveawayVisible) {
    events.push({
      key: "giveaway",
      // Deliberately started_at, not updated_at: the row is touched every time
      // someone enters, and ordering by that would throw the giveaway back to
      // the top on every entry — the behaviour being fixed here.
      startedAt: startedAtOr(giveaway.started_at, startedAtOr(giveaway.updated_at, 0)),
      node: <GiveawayCard state={giveaway} showElapsed fullWidth />,
    })
  }

  if (predictionSeconds > 0) {
    events.push({
      key: "prediction",
      // Falls back to "now minus what is left" when the window has no opens_at,
      // which still orders it correctly against the rest.
      startedAt: startedAtOr(prediction?.window?.opens_at, Date.now() - predictionSeconds * 1000),
      node: <PredictionEventCard secondsLeft={predictionSeconds} />,
    })
  }

  if (tournament.visible) {
    events.push({
      key: "tournament",
      startedAt: tournament.startedAt || Date.now(),
      node: <TournamentEventCard snapshot={tournament} />,
    })
  }

  for (const transaction of transactions) {
    events.push({
      key: transaction.id,
      startedAt: startedAtOr(transaction.created_at, Date.now()),
      node: <TransactionEventCard event={transaction} />,
    })
  }

  events.sort((a, b) => b.startedAt - a.startedAt)

  return (
    <div className="h-screen w-full bg-transparent">
      <div
        className="flex h-full w-full flex-col overflow-hidden p-2 shadow-2xl"
        style={{ backgroundColor: OBS.shell, borderRadius: OBS_RADIUS.shell }}
      >
        {/* Events, newest first. They were stacked by type before — giveaway,
            then prediction, then transactions — so a deposit that had just
            landed appeared below a giveaway that had been running for hours. */}
        <div className="flex shrink-0 flex-col gap-2">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <motion.div
                key={event.key}
                layout
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                {event.node}
              </motion.div>
            ))}
          </AnimatePresence>

          <BannerRotator />
        </div>

        <EventDivider />

        {/* Chat — takes every pixel the events left over */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <KickChatFeed messages={chatMessages} className="h-full" />
        </div>
      </div>
    </div>
  )
}

export default function StreamObsWidgetPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="h-screen w-full bg-transparent" />}>
      <StreamWidget />
    </Suspense>
  )
}
