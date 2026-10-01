"use client"

import { Calendar, Crosshair, Crown, Gift, ShoppingBag, Swords, Target } from "lucide-react"
import { visibleSections, type Section } from "@/lib/landing"
import { useLandingData, useNow } from "@/hooks/use-landing-data"
import { Hero } from "@/components/landing/hero"
import {
  ComingUp,
  HowItWorks,
  KickBand,
  LiveDeck,
  SiteIndex,
  WinnersTicker,
  type IndexEntry,
} from "@/components/landing/sections"

const SECTIONS: (Section & { icon: IndexEntry["icon"] })[] = [
  { href: "/bonushunt", code: "HUNT", accent: "amber", icon: Crosshair, module: "bonus_hunt", title: "Bonus hunt",
    copy: "Follow the bonuses as they are collected, then call the final balance before the opening starts." },
  { href: "/leaderboard", code: "BOARD", accent: "blue", icon: Crown, module: "leaderboard", title: "Leaderboard",
    copy: "Wagering moves you up the table. The top places are paid out at the end of every month." },
  { href: "/raffles", code: "RAFFLE", accent: "green", icon: Gift, module: "raffles", title: "Raffles",
    copy: "Low-entry draws running alongside the stream, with winners pulled live." },
  { href: "/tournaments", code: "VERSUS", accent: "purple", icon: Swords, module: "tournaments", title: "Tournaments",
    copy: "Bracket play against the rest of the community until one name is left." },
  { href: "/challenges", code: "CHALLENGE", accent: "red", icon: Target, module: "challenges", title: "Challenges",
    copy: "Hit the target on the slot that is set and claim the reward that goes with it." },
  { href: "/store", code: "STORE", accent: "pink", icon: ShoppingBag, module: "stream_store", title: "Store",
    copy: "Points earned watching the stream convert into rewards you can actually redeem." },
  { href: "/advent-calendar", code: "DEC", accent: "red", icon: Calendar, module: "advent_calendar", title: "Advent calendar",
    copy: "One door a day through December, each with something behind it." },
]

/**
 * The landing page.
 *
 * Top to bottom: what the site is and what is on air (hero), proof that people
 * get paid (ticker), what is running now (deck), when to tune in next, where
 * everything lives (index), how it works, and the way out to Kick. Data comes
 * from useLandingData; every block renders only when it has something real
 * to show.
 */
export default function LandingPage() {
  const data = useLandingData()
  const now = useNow()

  const sections = visibleSections(SECTIONS, data.modules) as (Section & { icon: IndexEntry["icon"] })[]
  const primary = data.modules.bonus_hunt
    ? { href: "/bonushunt", label: data.hunt ? "Live hunt" : "Bonus hunts" }
    : sections[0]
      ? { href: sections[0].href, label: sections[0].title }
      : undefined

  return (
    <div className="pb-10">
      <Hero data={data} now={now} primary={primary} />
      <WinnersTicker wins={data.wins} />
      <LiveDeck hunt={data.hunt} board={data.board} raffle={data.raffle} now={now} />
      {data.modules.schedule && <ComingUp entries={data.upcoming} />}
      <SiteIndex entries={sections} />
      <HowItWorks />
      <KickBand />
    </div>
  )
}
