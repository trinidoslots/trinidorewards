"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Calendar, Crosshair, Crown, Gift, Play, ShoppingBag, Swords, Ticket } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
import { WordsIn } from "@/components/reveal"
import { ALL_OFF, readModules, type ModuleStatus } from "@/lib/site-modules"
import { streamState, type ScheduleEntry, type StreamState } from "@/lib/schedule"
import { huntProgress, visibleSections, type Section } from "@/lib/landing"
import { countdownTo } from "@/lib/schedule-week"
import { money, moneyExact } from "@/lib/leaderboard-format"
import { readMetric } from "@/lib/leaderboard-metric"
import {
  BentoTile,
  LiveCard,
  LiveDot,
  MiniPodium,
  ProgressBar,
  SectionRule,
  Step,
} from "@/components/landing-blocks"
import { Hero } from "@/components/landing-hero"
import { MarqueeHeading, WinnersMarquee, type MarqueeWin } from "@/components/landing-marquee"
import { sourceMeta, winValue } from "@/lib/wins"

const KICK_URL = "https://kick.com/trinidoslots"

const SECTIONS: (Section & { icon: typeof Crosshair })[] = [
  { href: "/bonushunt", code: "HUNT", accent: "amber", icon: Crosshair, module: "bonus_hunt", title: "Bonus hunt",
    copy: "Follow the bonuses as they are collected, then call the final balance before the opening starts." },
  { href: "/leaderboard", code: "BOARD", accent: "blue", icon: Crown, module: "leaderboard", title: "Leaderboard",
    copy: "Wagering moves you up the table. The top places are paid out at the end of every month." },
  { href: "/raffles", code: "RAFFLE", accent: "green", icon: Gift, module: "raffles", title: "Raffles",
    copy: "Low-entry draws running alongside the stream, with winners pulled live." },
  { href: "/tournaments", code: "VERSUS", accent: "purple", icon: Swords, module: "tournaments", title: "Tournaments",
    copy: "Bracket play against the rest of the community until one name is left." },
  { href: "/store", code: "STORE", accent: "pink", icon: ShoppingBag, module: "stream_store", title: "Store",
    copy: "Points earned watching the stream convert into rewards you can actually redeem." },
  { href: "/advent-calendar", code: "DEC", accent: "red", icon: Calendar, module: "advent_calendar", title: "Advent calendar",
    copy: "One door a day through December, each with something behind it." },
]

type Hunt = { openedBonuses: number; totalBonuses: number; startingBalance: number; currentBalance: number; bestMultiplier: number; bestMultiplierGame: string | null }
type Board = { id: string; title: string; pool: number; endsAt: string; metric: string; top: string[] }
type Raffle = { id: string; title: string; prize: string | null; endsAt: string | null; tickets: number }

export default function LandingPage() {
  const supabaseRef = useRef(createClient())
  const [givenAway, setGivenAway] = useState<number | null>(null)
  const [modules, setModules] = useState<ModuleStatus>(ALL_OFF)
  const [stream, setStream] = useState<StreamState>({ kind: "none" })
  const [hunt, setHunt] = useState<Hunt | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [raffle, setRaffle] = useState<Raffle | null>(null)
  const [wins, setWins] = useState<MarqueeWin[]>([])
  const [tick, setTick] = useState(0)

  // One ticking clock for every countdown on the page, rather than one each.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    /**
     * Each block is loaded on its own and allowed to fail on its own. A landing
     * page that renders nothing because one table was unreachable is worse than
     * one that renders four fifths of itself.
     */
    const safely = async <T,>(what: string, run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run()
      } catch (error) {
        console.log(`[v0] landing: ${what} unavailable`, error)
        return null
      }
    }

    void (async () => {
      const [settings, moduleRows, schedule] = await Promise.all([
        safely("settings", async () =>
          (await supabase.from("settings").select("value").eq("key", "total_given_away").maybeSingle()).data),
        safely("modules", async () =>
          (await supabase.from("modules").select("module_name, is_enabled")).data),
        safely("schedule", async () =>
          (await supabase
            .from("stream_schedule")
            .select("*")
            .gte("starts_at", new Date(Date.now() - 6 * 3600_000).toISOString())
            .order("starts_at", { ascending: true })
            .limit(20)).data),
      ])
      if (cancelled) return

      const parsed = Number.parseInt(settings?.value ?? "", 10)
      if (Number.isFinite(parsed)) setGivenAway(parsed)
      if (moduleRows) setModules(readModules(moduleRows))
      if (schedule) setStream(streamState(schedule as ScheduleEntry[]))
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // The live blocks. Kept out of the first effect so a slow leaderboard never
  // holds up the hero, which is the part that has to be there immediately.
  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    void (async () => {
      // --- the running hunt -------------------------------------------------
      try {
        const { data } = await supabase
          .from("bonus_hunt_kpis")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!cancelled && data) {
          setHunt({
            openedBonuses: Number(data.opened_bonuses) || 0,
            totalBonuses: Number(data.total_bonuses) || 0,
            startingBalance: Number(data.starting_balance) || 0,
            currentBalance: Number(data.current_balance) || 0,
            bestMultiplier: Number(data.best_multiplier) || 0,
            bestMultiplierGame: data.best_multiplier_game ?? null,
          })
        }
      } catch (error) {
        console.log("[v0] landing: hunt unavailable", error)
      }

      // --- the running leaderboard, and its top three -----------------------
      try {
        const { data: boards } = await supabase
          .from("leaderboards")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6)

        const now = Date.now()
        const live = (boards ?? []).find(
          (row: any) => Date.parse(row.start_date) <= now && now < Date.parse(row.end_date),
        )

        if (live && !cancelled) {
          const metric = readMetric(live.ranking_metric)
          const column = metric === "earned" ? "total_earned" : "total_wagered"
          // Ordering in the database rather than reading the whole field to
          // show three names. If the column is not there yet — 054 unrun — the
          // card still has its pool and simply has no podium.
          const { data: top } = await supabase
            .from("leaderboard_entries")
            .select("username")
            .eq("leaderboard_id", live.id)
            .order(column, { ascending: false })
            .limit(3)

          setBoard({
            id: live.id,
            title: live.title,
            pool: Number(live.prize_pool) || 0,
            endsAt: live.end_date,
            metric,
            top: (top ?? []).map((row: any) => String(row.username)),
          })
        }
      } catch (error) {
        console.log("[v0] landing: leaderboard unavailable", error)
      }

      // --- a running raffle -------------------------------------------------
      try {
        const { data } = await supabase
          .from("raffles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(8)

        const now = Date.now()
        const live = (data ?? []).find(
          (row: any) =>
            !row.is_hidden &&
            !row.winner_username &&
            (!row.end_date || Date.parse(row.end_date) > now),
        )
        if (live && !cancelled) {
          setRaffle({
            id: live.id,
            title: live.title,
            prize: live.prize ?? live.prize_description ?? null,
            endsAt: live.end_date ?? null,
            tickets: Number(live.tickets_sold) || 0,
          })
        }
      } catch (error) {
        console.log("[v0] landing: raffles unavailable", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])


  // --- recent winners, for the ticker ---------------------------------------
  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from("win_logs")
          .select("id, username, prize, amount, points, source")
          .order("created_at", { ascending: false })
          .limit(12)
        if (cancelled || !data) return
        setWins(
          data.map((row: any) => ({
            id: String(row.id),
            username: String(row.username ?? "Anonymous"),
            prize: winValue(row) === "—" ? String(row.prize ?? "") : winValue(row),
            accent: ACCENTS[sourceMeta(String(row.source)).accent] as string,
          })).filter((win) => win.prize),
        )
      } catch (error) {
        console.log("[v0] landing: winners unavailable", error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const sections = visibleSections(SECTIONS, modules) as (Section & { icon: typeof Crosshair })[]
  const progress = hunt ? huntProgress(hunt) : null
  const boardLeft = board ? countdownTo(board.endsAt) : null
  const raffleLeft = raffle?.endsAt ? countdownTo(raffle.endsAt) : null
  const streamLeft = stream.kind === "next" ? countdownTo(stream.startsAt) : null

  // The interval above is what re-runs this render each second, which is what
  // moves the countdowns; countdownTo is called fresh every time. Touching the
  // value keeps it from reading as unused state.
  void tick

  const status =
    stream.kind === "live"
      ? { live: true, label: "On air now", detail: stream.title }
      : stream.kind === "next" && streamLeft && !streamLeft.over
        ? { live: false, label: "Next stream", detail: `in ${streamLeft.days}d ${streamLeft.hours}h ${streamLeft.minutes}m` }
        : { live: false, label: "Free to enter", detail: "No deposit to take part" }

  /** The card that floats beside the headline: whatever is most live. */
  const aside = hunt && progress ? (
    <div className="lift relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-[0.18] blur-[60px]"
        style={{ background: ACCENTS.amber }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <LiveDot color={ACCENTS.amber} />
          <MonoLabel style={{ color: ACCENTS.amber }}>Hunt in progress</MonoLabel>
        </div>
        <p className="mt-5 text-[40px] font-black leading-none tabular-nums text-white">
          {moneyExact(hunt.currentBalance)}
        </p>
        <p className="mt-2 text-[13px] text-white/40">
          <span style={{ color: progress.ahead ? ACCENTS.green : ACCENTS.red }}>
            {progress.ahead ? "+" : "−"}
            {moneyExact(Math.abs(progress.profit)).replace("-", "")}
          </span>{" "}
          against a {moneyExact(hunt.startingBalance)} start
        </p>
        <div className="mt-6 space-y-2.5">
          <ProgressBar percent={progress.percent} color={ACCENTS.amber} />
          <div className="flex items-center justify-between">
            <MonoLabel className="text-white/30">{progress.label}</MonoLabel>
            {hunt.bestMultiplier > 0 && (
              <MonoLabel style={{ color: ACCENTS.amber }}>Best {hunt.bestMultiplier.toFixed(0)}x</MonoLabel>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : board ? (
    <div className="lift relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-[0.18] blur-[60px]"
        style={{ background: ACCENTS.blue }}
      />
      <div className="relative">
        <MonoLabel style={{ color: ACCENTS.blue }}>Leaderboard live</MonoLabel>
        <p className="mt-5 text-[40px] font-black leading-none tabular-nums text-white">{money(board.pool)}</p>
        <p className="mt-2 text-[13px] text-white/40">
          {boardLeft && !boardLeft.over
            ? `Ends in ${boardLeft.days}d ${boardLeft.hours}h ${boardLeft.minutes}m`
            : board.title}
        </p>
        {board.top.length > 0 && (
          <div className="mt-6">
            <MiniPodium names={board.top} />
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div>
      <Hero
        status={status}
        givenAway={givenAway === null ? null : money(givenAway)}
        kickUrl={KICK_URL}
        primary={
          modules.bonus_hunt
            ? { href: "/bonushunt", label: "Live hunt" }
            : sections[0]
              ? { href: sections[0].href, label: sections[0].title }
              : undefined
        }
        aside={aside}
      />

      {wins.length > 0 && (
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <MarqueeHeading />
          <WinnersMarquee wins={wins} />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-5 pb-16 lg:px-8">
        {/* --------------------------------------------------- Running now */}
        {(hunt || board || raffle) && (
          <>
            <SectionRule label="Running right now" />
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {hunt && progress && (
                <LiveCard
                  href="/bonushunt"
                  code="Bonus hunt"
                  accent="amber"
                  headline={moneyExact(hunt.currentBalance)}
                  sub={progress.label}
                >
                  <ProgressBar percent={progress.percent} color={ACCENTS.amber} />
                </LiveCard>
              )}
              {board && (
                <LiveCard
                  href="/leaderboard"
                  code="Leaderboard"
                  accent="blue"
                  headline={money(board.pool)}
                  sub={
                    boardLeft && !boardLeft.over
                      ? `Ends in ${boardLeft.days}d ${boardLeft.hours}h ${boardLeft.minutes}m`
                      : board.title
                  }
                >
                  {board.top.length > 0 ? (
                    <MiniPodium names={board.top} />
                  ) : (
                    <MonoLabel className="text-white/25">No entries yet</MonoLabel>
                  )}
                </LiveCard>
              )}
              {raffle && (
                <LiveCard
                  href="/raffles"
                  code="Raffle"
                  accent="green"
                  headline={raffle.prize || raffle.title}
                  sub={
                    raffleLeft && !raffleLeft.over
                      ? `Draws in ${raffleLeft.days}d ${raffleLeft.hours}h ${raffleLeft.minutes}m`
                      : "Drawing soon"
                  }
                >
                  <div className="flex items-center gap-2">
                    <Ticket className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} />
                    <MonoLabel className="text-white/40">
                      {raffle.tickets.toLocaleString("en-US")} {raffle.tickets === 1 ? "ticket" : "tickets"} in
                    </MonoLabel>
                  </div>
                </LiveCard>
              )}
            </div>
          </>
        )}

        {/* ------------------------------------------------------ How it works */}
        <SectionRule label="How it works" />
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          <Step n={1} title="Watch the stream" copy="Everything starts on Kick. Being there is the entry — there is nothing to buy." />
          <Step n={2} title="Take part" copy="Call the bonus hunt balance, enter a raffle, climb the leaderboard, join a tournament." />
          <Step n={3} title="Get paid" copy="Winners are recorded and paid out. The log on this site is the same one used to settle them." />
        </div>

        {/* ------------------------------------------------------------ Bento */}
        {sections.length > 0 && (
          <>
            <SectionRule label="Everything on the site" />
            <div className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((section, index) => (
                <BentoTile
                  key={section.href}
                  href={section.href}
                  code={section.code}
                  accent={section.accent}
                  title={section.title}
                  copy={section.copy}
                  icon={section.icon}
                  // The first tile takes two columns, so the grid has a
                  // shape and the eye has somewhere to start.
                  span={index === 0}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* --------------------------------------------------------- Kick band */}
      <section className="relative w-full overflow-hidden border-y border-white/[0.06] bg-[#08080A]">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.12] blur-[100px]"
          style={{ background: "#53FC18" }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-6 px-5 py-14 lg:px-8 lg:py-16">
          <div className="min-w-0 flex-1">
            <h2 className="text-[clamp(22px,3.4vw,32px)] font-black uppercase leading-tight tracking-tight text-white">
              Giveaways run live on stream
            </h2>
            <p className="mt-3 max-w-lg text-[13.5px] leading-7 text-white/45">
              A keyword drops in chat, the wheel spins live, the winner is paid on the spot. Nothing to buy — being
              there is the whole entry.
            </p>
          </div>
          <a
            href={KICK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="lift inline-flex shrink-0 items-center gap-2 rounded-lg px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#08080A]"
            style={{ backgroundColor: "#53FC18", boxShadow: "0 8px 30px -10px #53FC18" }}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Watch on Kick
          </a>
        </div>
      </section>

      <p className="mx-auto max-w-6xl px-5 py-10 font-mono text-[10px] uppercase tracking-[0.12em] text-white/20 lg:px-8">
        18+ · Play responsibly
      </p>
    </div>
  )
}
