"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { GiveawayCard, isGiveawayActive, useGiveawayState } from "@/components/obs/giveaway-card"
import {
  BannerRotator,
  EventDivider,
  TransactionEventCard,
  useTransactionEvents,
} from "@/components/obs/stream-event-feed"
import { KickChatFeed } from "@/components/kick-chat-feed"
import { useKickChat } from "@/hooks/use-kick-chat"

const DEFAULT_SLUG = "trinidoslots"

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

  const giveaway = useGiveawayState()
  const transactions = useTransactionEvents()
  const { messages } = useKickChat({ slug })

  const giveawayVisible = isGiveawayActive(giveaway)

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-transparent p-2">
      {/* Events — sized by their content so the chat keeps the rest of the column */}
      <div className="flex shrink-0 flex-col gap-2">
        <AnimatePresence initial={false}>
          {giveawayVisible && (
            <motion.div
              key="giveaway"
              layout
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <GiveawayCard state={giveaway} showElapsed fullWidth />
            </motion.div>
          )}

          {transactions.map((event) => (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <TransactionEventCard event={event} />
            </motion.div>
          ))}
        </AnimatePresence>

        <BannerRotator />
      </div>

      <EventDivider />

      {/* Chat — takes every pixel the events left over */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#070809]/90 shadow-lg backdrop-blur-sm">
        <KickChatFeed messages={messages} className="h-full py-1.5" />
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
