"use client"

import Link from "next/link"
import { ArrowRight, ArrowUpRight, Radio } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { countdownTo } from "@/lib/schedule-week"
import { money, moneyExact } from "@/lib/leaderboard-format"
import { huntProgress } from "@/lib/landing"
import type { StreamState } from "@/lib/schedule"
import type { LandingData } from "@/hooks/use-landing-data"
import { Clock, CountUp, KICK_URL, KickButton, LiveDot, shortLeft } from "@/components/landing/parts"

/**
 * The hero: a statement on the left, the on-air console on the right.
 *
 * The headline says what the site is for in three words instead of repeating
 * the name that is already in the top bar. The console is the part that
 * changes: on air, counting down to the next stream, or — between schedules —
 * simply what is running. It is the first thing on the page that is live, so
 * it is the first thing on the page that moves.
 */

export function Hero({
  data,
  now,
  primary,
}: {
  data: LandingData
  now: number
  primary?: { href: string; label: string }
}) {
  const { stream, givenAway } = data
  const live = stream.kind === "live"
  // The one wash on the page, and it carries meaning: red while on air,
  // the board blue otherwise.
  const glow = live ? ACCENTS.red : ACCENTS.blue

  return (
    <section className="relative w-full overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(1100px 520px at 72% -10%, ${glow}26, transparent 60%), radial-gradient(800px 480px at 0% 110%, ${ACCENTS.green}14, transparent 60%), #08080A`,
        }}
      />
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-0"
        style={{
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-2 pr-3.5 backdrop-blur">
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-black"
              style={{ backgroundColor: ACCENTS.green }}
            >
              Free
            </span>
            <span className="text-[12.5px] text-white/60">No deposit needed to take part</span>
          </div>

          <h1 className="mt-7 text-[clamp(52px,8.4vw,112px)] font-black uppercase leading-[0.86] tracking-[-0.045em] text-white">
            <span className="block">Watch.</span>
            <span className="block text-white/55">Play.</span>
            <span className="block" style={{ color: ACCENTS.green }}>
              Get paid.
            </span>
          </h1>

          <p className="mt-7 max-w-[30rem] text-[16px] leading-7 text-white/55">
            Bonus hunts, leaderboards, raffles and tournaments for the TrinidoSlots community — running alongside
            every stream, all free to enter.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <KickButton />
            {primary && (
              <Link
                href={primary.href}
                className="group inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-[14px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                {primary.label}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>

          {givenAway !== null && (
            <div className="mt-12 flex items-center gap-5 border-t border-white/[0.08] pt-6">
              <CountUp
                value={givenAway}
                className="text-[clamp(36px,4.6vw,52px)] font-black leading-none tabular-nums tracking-[-0.03em]"
                style={{ color: ACCENTS.green }}
              />
              <p className="max-w-[9rem] text-[13px] leading-snug text-white/45">
                given away to the community so far
              </p>
            </div>
          )}
        </div>

        <Console data={data} now={now} stream={stream} />
      </div>
    </section>
  )
}

/** The panel beside the headline. */
function Console({ data, now, stream }: { data: LandingData; now: number; stream: StreamState }) {
  const { hunt, board, raffle } = data
  const next = stream.kind === "next" ? countdownTo(stream.startsAt, now) : null
  const progress = hunt ? huntProgress(hunt) : null

  const rows: { href: string; label: string; accent: string; value: string; meta: string }[] = []
  if (hunt && progress) {
    rows.push({
      href: "/bonushunt",
      label: "Bonus hunt",
      accent: ACCENTS.amber,
      value: moneyExact(hunt.currentBalance),
      meta: progress.label,
    })
  }
  if (board) {
    rows.push({
      href: "/leaderboard",
      label: "Leaderboard pool",
      accent: ACCENTS.blue,
      value: money(board.pool),
      meta: `Ends in ${shortLeft(countdownTo(board.endsAt, now), "—")}`,
    })
  }
  if (raffle) {
    rows.push({
      href: "/raffles",
      label: "Raffle",
      accent: ACCENTS.pink,
      value: raffle.prize || raffle.title,
      meta: `${raffle.tickets.toLocaleString("en-US")} ${raffle.tickets === 1 ? "ticket" : "tickets"} in`,
    })
  }

  return (
    <div className="relative">
      {/* A soft halo behind the panel so it sits on the page rather than in it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[36px] opacity-60 blur-2xl"
        style={{ background: `radial-gradient(closest-side, ${stream.kind === "live" ? ACCENTS.red : ACCENTS.blue}22, transparent)` }}
      />
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.10] bg-[#0E0E12]/90 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur">
        {/* --- the screen ----------------------------------------------------- */}
        <div className="border-b border-white/[0.07] p-6 sm:p-7">
          {stream.kind === "live" ? (
            <>
              <div className="flex items-center gap-2.5">
                <LiveDot color={ACCENTS.red} size={10} />
                <MonoLabel style={{ color: ACCENTS.red }}>On air now</MonoLabel>
              </div>
              <p className="mt-4 text-[clamp(24px,3vw,32px)] font-black leading-tight tracking-tight text-white">
                {stream.title}
              </p>
              <a
                href={KICK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 transition hover:text-white"
              >
                Join the stream <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </>
          ) : next && !next.over ? (
            <>
              <div className="flex items-center gap-2.5">
                <Radio className="h-4 w-4" style={{ color: ACCENTS.blue }} />
                <MonoLabel style={{ color: ACCENTS.blue }}>Next stream</MonoLabel>
                <span className="ml-auto truncate text-[12.5px] text-white/45">
                  {stream.kind === "next" ? stream.title : ""}
                </span>
              </div>
              <div className="mt-5">
                <Clock left={next} accent={ACCENTS.blue} />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Radio className="h-4 w-4 text-white/40" />
                <MonoLabel className="text-white/45">Off air</MonoLabel>
              </div>
              <p className="mt-4 text-[24px] font-black leading-tight tracking-tight text-white">
                Follow on Kick to catch the next one.
              </p>
            </>
          )}
        </div>

        {/* --- what is running ------------------------------------------------ */}
        {rows.length > 0 ? (
          <ul>
            {rows.map((row) => (
              <li key={row.href} className="border-b border-white/[0.06] last:border-b-0">
                <Link
                  href={row.href}
                  className="group flex items-center gap-4 px-6 py-4 transition hover:bg-white/[0.035] sm:px-7"
                >
                  <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: row.accent }} />
                  <div className="min-w-0 flex-1">
                    <MonoLabel style={{ color: row.accent }}>{row.label}</MonoLabel>
                    <p className="mt-1.5 truncate text-[22px] font-bold leading-none tabular-nums text-white">
                      {row.value}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-right text-[12px] text-white/40 sm:block">{row.meta}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/80" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-7 py-6 text-[13px] leading-6 text-white/40">
            Hunts, boards and raffles show up here the moment they open.
          </p>
        )}
      </div>
    </div>
  )
}
