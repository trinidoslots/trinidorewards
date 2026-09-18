"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, Calendar, Crosshair, Crown, Gift, Play, ShoppingBag, Swords } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, StatTile, type Accent } from "@/components/ui/panel"
import { WordsIn } from "@/components/reveal"

const KICK_URL = "https://kick.com/trinidoslots"

const SECTIONS: {
  href: string
  code: string
  accent: Accent
  icon: typeof Crosshair
  title: string
  copy: string
}[] = [
  {
    href: "/bonushunt",
    code: "HUNT",
    accent: "amber",
    icon: Crosshair,
    title: "Bonus hunt",
    copy: "Follow the bonuses as they are collected, then call the final balance before the opening starts.",
  },
  {
    href: "/leaderboard",
    code: "BOARD",
    accent: "blue",
    icon: Crown,
    title: "Leaderboard",
    copy: "Wagering moves you up the table. The top places are paid out at the end of every month.",
  },
  {
    href: "/raffles",
    code: "RAFFLE",
    accent: "green",
    icon: Gift,
    title: "Raffles",
    copy: "Low-entry draws running alongside the stream, with winners pulled live.",
  },
  {
    href: "/tournaments",
    code: "VERSUS",
    accent: "purple",
    icon: Swords,
    title: "Tournaments",
    copy: "Bracket play against the rest of the community until one name is left.",
  },
  {
    href: "/store",
    code: "STORE",
    accent: "pink",
    icon: ShoppingBag,
    title: "Store",
    copy: "Points earned watching the stream convert into rewards you can actually redeem.",
  },
  {
    href: "/advent-calendar",
    code: "DEC",
    accent: "red",
    icon: Calendar,
    title: "Advent calendar",
    copy: "One door a day through December, each with something behind it.",
  },
]

export default function LandingPage() {
  const [givenAway, setGivenAway] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "total_given_away")
          .maybeSingle()
        const parsed = Number.parseInt(data?.value ?? "", 10)
        if (Number.isFinite(parsed)) setGivenAway(parsed)
      } catch (error) {
        // The page reads fine without it; never let one stat break it.
        console.log("[v0] Error fetching total given away:", error)
      }
    }
    load()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
      {/* ------------------------------------------------------------ Header */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[34px]">
            {/* Word by word, which is what makes the landing read as arriving
                rather than as already having been there. */}
            <WordsIn text="TrinidoRewards" />
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-white/45">
            Everything running alongside the stream — <span className="text-white/70">bonus hunts</span>,{" "}
            <span className="text-white/70">predictions</span>, <span className="text-white/70">leaderboards</span>,{" "}
            <span className="text-white/70">raffles</span> and <span className="text-white/70">giveaways</span>. Free to
            take part in. Pick a section below.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link
            href="/bonushunt"
            className="rounded-md border border-white/12 bg-white/[0.06] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
          >
            Live hunt
          </Link>
          <a
            href={KICK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <Play className="h-3 w-3 fill-current" />
            Kick
          </a>
        </div>
      </header>

      {/* ------------------------------------------------------------- Stats */}
      <div className="mt-8 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile
          label="Given away"
          accent="green"
          value={givenAway === null ? "—" : `$${givenAway.toLocaleString()}`}
        />
        <StatTile label="Members" value="10K+" />
        <StatTile label="Entry cost" accent="blue" value="Free" hint="No deposit to take part" />
        <StatTile label="Sections" accent="purple" value={SECTIONS.length} />
      </div>

      {/* ---------------------------------------------------------- Sections */}
      <div className="mt-10 flex items-center gap-3">
        <MonoLabel className="text-white/35">Sections</MonoLabel>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, code, accent, icon: Icon, title, copy }) => (
          <Link key={href} href={href} className="group block">
            <Panel
              accent={accent}
              className="h-full p-4 transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" style={{ color: ACCENTS[accent] }} />
                <MonoLabel style={{ color: ACCENTS[accent] }}>{code}</MonoLabel>
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-white/20 transition group-hover:text-white/60" />
              </div>
              <h2 className="mt-3 text-[15px] font-semibold text-white">{title}</h2>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-white/40">{copy}</p>
            </Panel>
          </Link>
        ))}
      </div>

      {/* ------------------------------------------------------------- Live */}
      <div className="mt-10 flex items-center gap-3">
        <MonoLabel className="text-white/35">Live</MonoLabel>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <Panel className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: ACCENTS.red }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: ACCENTS.red }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white">Giveaways run on stream</p>
          <p className="mt-1 text-[12.5px] leading-6 text-white/40">
            A keyword drops in chat, the wheel spins live, the winner is paid on the spot.
          </p>
        </div>
        <a
          href={KICK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.06] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
        >
          <Play className="h-3 w-3 fill-current" />
          Watch
        </a>
      </Panel>

      <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.12em] text-white/20">
        18+ · Play responsibly
      </p>
    </div>
  )
}
