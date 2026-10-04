"use client"

import type React from "react"
import { Calendar, Crosshair, Crown, Gift, ShoppingBag, Swords, Target } from "lucide-react"
import { huntProgress, visibleSections, type Section } from "@/lib/landing"
import { countdownTo } from "@/lib/schedule-week"
import { useLandingData, useNow, type LandingData } from "@/hooks/use-landing-data"
import { Hero } from "@/components/landing/hero"
import { shortLeft } from "@/components/landing/parts"
import {
  AdventMedia,
  BoardMedia,
  ChallengeMedia,
  HuntMedia,
  RaffleMedia,
  StoreMedia,
  TournamentMedia,
} from "@/components/landing/media"
import { Bento, type ModuleCardData } from "@/components/landing/sections"

type LandingSection = Section & { icon: ModuleCardData["icon"] }

const SECTIONS: LandingSection[] = [
  { href: "/bonushunt", code: "HUNT", accent: "amber", icon: Crosshair, module: "bonus_hunt", title: "Bonus hunt",
    copy: "Follow the bonuses as they are collected, then call the final balance before the opening starts." },
  { href: "/leaderboard", code: "BOARD", accent: "blue", icon: Crown, module: "leaderboard", title: "Leaderboard",
    copy: "Wagering moves you up the table. The top places are paid out at the end of every month." },
  { href: "/raffles", code: "RAFFLE", accent: "pink", icon: Gift, module: "raffles", title: "Raffles",
    copy: "Low-entry draws running alongside the stream, with winners pulled live." },
  { href: "/tournaments", code: "VERSUS", accent: "purple", icon: Swords, module: "tournaments", title: "Tournaments",
    copy: "Bracket play against the rest of the community until one name is left." },
  { href: "/challenges", code: "CHALLENGE", accent: "red", icon: Target, module: "challenges", title: "Challenges",
    copy: "Hit the target on the slot that is set and claim the reward that goes with it." },
  { href: "/store", code: "STORE", accent: "green", icon: ShoppingBag, module: "stream_store", title: "Store",
    copy: "Points earned watching the stream convert into rewards you can actually redeem." },
  { href: "/advent-calendar", code: "DEC", accent: "red", icon: Calendar, module: "advent_calendar", title: "Advent calendar",
    copy: "One door a day through December, each with something behind it." },
]

/**
 * The landing page: the headline, then every section of the site as a bento
 * of pictures, what is running first. Kept to those two blocks on purpose —
 * the quietest sites in the inspiration set (Midday, Cursor, Ponder) say one
 * thing and show one thing. Data comes from useLandingData.
 */
export default function LandingPage() {
  const data = useLandingData()
  const now = useNow()

  const sections = visibleSections(SECTIONS, data.modules) as LandingSection[]
  const cards = sections.map((section) => cardFor(section, data, now))
  // What is running goes first, in the order above; the rest keep theirs.
  const ordered = [...cards.filter((card) => card.live), ...cards.filter((card) => !card.live)]
  const liveCount = ordered.filter((card) => card.live).length

  return (
    <div className="pb-10">
      <Hero data={data} now={now} />
      <Bento cards={ordered} liveCount={liveCount} />
    </div>
  )
}

/** A section's card: its picture, and its live state when there is one. */
function cardFor(section: LandingSection, data: LandingData, now: number): ModuleCardData {
  const base = { href: section.href, title: section.title, copy: section.copy, accent: section.accent, icon: section.icon }
  let media: React.ReactNode = null
  let live: string | undefined

  switch (section.href) {
    case "/bonushunt":
      media = <HuntMedia hunt={data.hunt} />
      if (data.hunt) live = huntProgress(data.hunt).label
      break
    case "/leaderboard":
      media = <BoardMedia board={data.board} now={now} />
      if (data.board) live = `Ends in ${shortLeft(countdownTo(data.board.endsAt, now), "—")}`
      break
    case "/raffles":
      media = <RaffleMedia raffle={data.raffle} now={now} />
      if (data.raffle) live = `${data.raffle.tickets.toLocaleString("en-US")} tickets`
      break
    case "/tournaments":
      media = <TournamentMedia />
      break
    case "/challenges":
      media = <ChallengeMedia />
      break
    case "/store":
      media = <StoreMedia />
      break
    case "/advent-calendar":
      media = <AdventMedia now={now} />
      break
  }

  return { ...base, media, live }
}
