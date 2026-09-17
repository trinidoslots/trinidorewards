"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowRight,
  Calendar,
  Crosshair,
  Crown,
  Gift,
  Play,
  ShoppingBag,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// One accent ramp for the whole page, matching the OBS widgets so the site and
// the stream overlay read as the same product.
const ACCENT = "#4D84FF"
const ACCENT_SOFT = "#7FB3FF"
const ACCENT_ALT = "#B18CFF"

const WAYS_TO_WIN = [
  {
    href: "/bonushunt",
    icon: Crosshair,
    label: "Bonus hunt",
    copy: "Follow the hunt live and call the final balance before it opens.",
  },
  {
    href: "/leaderboard",
    icon: Crown,
    label: "Leaderboard",
    copy: "Every wager moves you up. The top of the board gets paid.",
  },
  { href: "/raffles", icon: Gift, label: "Raffles", copy: "Low-entry draws running all month long." },
  { href: "/tournaments", icon: Swords, label: "Tournaments", copy: "Bracket play against the rest of the community." },
  { href: "/store", icon: ShoppingBag, label: "Store", copy: "Turn the points you earn watching into real rewards." },
  {
    href: "/advent-calendar",
    icon: Calendar,
    label: "Advent calendar",
    copy: "A new door, a new reward, every day in December.",
  },
]

export default function LandingPage() {
  const [totalGivenAway, setTotalGivenAway] = useState<number | null>(null)

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
        if (Number.isFinite(parsed)) setTotalGivenAway(parsed)
      } catch (error) {
        // The hero reads fine without it; never let a stat break the page.
        console.log("[v0] Error fetching total given away:", error)
      }
    }
    load()
  }, [])

  return (
    <div className="relative overflow-hidden">
      {/* Aurora — two soft pools of brand colour behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px]"
        style={{
          background: `radial-gradient(60% 55% at 22% 0%, ${ACCENT}26 0%, transparent 60%),
                       radial-gradient(45% 45% at 85% 12%, ${ACCENT_ALT}1f 0%, transparent 65%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(80% 50% at 50% 0%, #000 0%, transparent 75%)",
        }}
      />

      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative px-5 pb-16 pt-16 lg:px-10 lg:pb-24 lg:pt-24">
        <div className="mx-auto max-w-6xl">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ borderColor: `${ACCENT}44`, backgroundColor: `${ACCENT}14`, color: ACCENT_SOFT }}
          >
            <Sparkles className="h-3 w-3" />
            The Trinido rewards community
          </span>

          <h1 className="mt-7 max-w-4xl text-balance text-5xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-7xl lg:text-8xl">
            Watch the hunt.
            <br />
            <span
              style={{
                background: `linear-gradient(100deg, ${ACCENT_SOFT}, ${ACCENT} 45%, ${ACCENT_ALT})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Take a cut.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-slate-400">
            Predictions, leaderboards, raffles and giveaways — every stream turns into something you can actually win.
            No deposit needed to play along.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/bonushunt"
              className="group inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-bold text-slate-950 transition hover:brightness-110"
              style={{ backgroundColor: ACCENT_SOFT, boxShadow: `0 18px 40px -18px ${ACCENT}` }}
            >
              See the live hunt
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://kick.com/trinidoslots"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-7 py-4 text-base font-bold text-white backdrop-blur transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              <Play className="h-4 w-4 fill-current" />
              Watch on Kick
            </a>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
            <Stat
              icon={TrendingUp}
              label="Given away"
              value={totalGivenAway === null ? "—" : `$${totalGivenAway.toLocaleString()}`}
            />
            <Stat icon={Users} label="Members" value="10K+" />
            <Stat icon={Gift} label="Entry cost" value="Free" className="col-span-2 sm:col-span-1" />
          </dl>
        </div>
      </section>

      {/* -------------------------------------------------------- Ways to win */}
      <section className="relative px-5 py-16 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT_SOFT }}>
                Ways to win
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Pick your lane</h2>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WAYS_TO_WIN.map(({ href, icon: Icon, label, copy }) => (
              <Link
                key={href}
                href={href}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{ backgroundColor: `${ACCENT}33` }}
                />
                <span
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border"
                  style={{ borderColor: `${ACCENT}33`, backgroundColor: `${ACCENT}14`, color: ACCENT_SOFT }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="relative mt-6 text-lg font-bold text-white">{label}</h3>
                <p className="relative mt-2 text-sm leading-6 text-slate-400">{copy}</p>
                <span
                  className="relative mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                  style={{ color: ACCENT_SOFT }}
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Closer */}
      <section className="relative px-5 pb-24 lg:px-10">
        <div
          className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 p-10 sm:p-14"
          style={{
            background: `linear-gradient(120deg, ${ACCENT}1f 0%, transparent 45%), linear-gradient(300deg, ${ACCENT_ALT}1a 0%, transparent 50%), rgba(255,255,255,0.02)`,
          }}
        >
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div>
              <h2 className="max-w-lg text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Next giveaway runs on stream.
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-400">
                Keyword drops in chat, the wheel spins live, the winner is paid out on the spot. Be there.
              </p>
            </div>
            <a
              href="https://kick.com/trinidoslots"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-7 py-4 text-base font-bold text-slate-950 transition hover:brightness-110"
              style={{ backgroundColor: ACCENT_SOFT }}
            >
              <Play className="h-4 w-4 fill-current" />
              Join the stream
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Users
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`bg-slate-950/80 px-6 py-5 ${className ?? ""}`}>
      <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
        <Icon className="h-3.5 w-3.5" style={{ color: ACCENT_SOFT }} />
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-black tabular-nums text-white sm:text-3xl">{value}</dd>
    </div>
  )
}
