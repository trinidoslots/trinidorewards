"use client"

import { GiveawayCard, useGiveawayState } from "@/components/obs/giveaway-card"

export default function GiveawayObsWidget() {
  const state = useGiveawayState()

  return (
    <div className="min-h-screen bg-transparent p-4">
      <GiveawayCard state={state} />
    </div>
  )
}
