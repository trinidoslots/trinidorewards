"use client"

import Link from "next/link"
import type React from "react"
import { ArrowRight, ArrowUpRight, Play } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { countdownTo } from "@/lib/schedule-week"
import type { LandingData } from "@/hooks/use-landing-data"
import { CountUp, KICK_GREEN, KICK_URL } from "@/components/landing/parts"

/**
 * The top of the landing page, in the same language as the rewards bento
 * under it: the bracketed monospaced label, a headline in two tones, and on
 * the right a card built exactly like a bento card — dot field, rounded
 * frame, label row, round arrow — holding the one thing that changes most:
 * when the stream is on, and who was paid out last.
 */
export function Hero({ data, now }: { data: LandingData; now: number }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:pb-28 lg:pt-24">
      <div>
        <Label index="01">TrinidoRewards</Label>

        <h1 className="mt-6 text-[clamp(38px,4.4vw,56px)] font-semibold leading-[1.04] tracking-[-0.045em] text-white">
          Rewards for watching.
          <br />
          <span className="text-white/40">Free to enter, every stream.</span>
        </h1>

        <p className="mt-6 max-w-lg text-[16.5px] leading-[1.65] text-white/50">
          Bonus hunts, leaderboards, raffles and tournaments for the TrinidoSlots community. No deposit needed.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a
            href={KICK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14.5px] font-medium text-black transition hover:bg-white/90 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Watch on Kick
          </a>
          <Link
            href="#now"
            className="group inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-[14.5px] font-medium text-white/70 transition hover:border-white/25 hover:text-white"
          >
            See what&apos;s running
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <StreamCard data={data} now={now} />
    </section>
  )
}

/** "[ 01 ] TRINIDOREWARDS" — the same label the bento uses. */
function Label({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <span className="font-geist-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
      <span className="text-white/25">[ {index} ]</span>
      {children}
    </span>
  )
}

/**
 * The card beside the headline. Built like a bento card so the two blocks
 * read as one page: the picture is the stream's state (on air, or counting
 * down), with the latest payouts under it; the text row is the total given
 * away and the way to Kick.
 */
function StreamCard({ data, now }: { data: LandingData; now: number }) {
  const { stream, wins, givenAway } = data
  const live = stream.kind === "live"
  const next = stream.kind === "next" ? countdownTo(stream.startsAt, now) : null
  const upcoming = next !== null && !next.over
  const color = live ? ACCENTS.red : KICK_GREEN
  const title = live || upcoming ? (stream as { title: string }).title : null

  return (
    <a
      href={KICK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-2 transition duration-300 hover:border-white/[0.18]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-45"
        style={{ backgroundColor: color }}
      />

      {/* The picture: the stream's state, then the latest payouts. */}
      <div className="lp-dots relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0d10] p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(70% 80% at 85% 0%, ${color}24, transparent 70%)` }}
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span
              className="font-geist-mono flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.14em]"
              style={{ color }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full opacity-70" style={{ backgroundColor: color }} />
                <span className="relative h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              </span>
              {live ? "On air now" : upcoming ? "Next stream" : "On Kick"}
            </span>
            {title && (
              <span className="font-geist-mono truncate rounded-md bg-black/40 px-2 py-1 text-[10.5px] text-white/50">
                {title}
              </span>
            )}
          </div>

          <p className="mt-5 text-[clamp(36px,4.4vw,52px)] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white">
            {live ? "Live now" : upcoming && next ? <Countdown left={next} /> : "Follow along"}
          </p>
          <p className="mt-2 text-[13.5px] text-white/45">
            {live
              ? "Join the stream to take part."
              : upcoming
                ? "Until the stream starts."
                : "Streams are announced on the schedule."}
          </p>

          {wins.length > 0 && (
            <div className="mt-7">
              <span className="font-geist-mono text-[10.5px] uppercase tracking-[0.14em] text-white/35">
                Paid out recently
              </span>
              <ul className="mt-3 space-y-1.5">
                {wins.slice(0, 3).map((win) => (
                  <li
                    key={win.id}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[13px]"
                  >
                    <span className="truncate text-white/70">{win.username}</span>
                    <span className="font-medium tabular-nums" style={{ color: KICK_GREEN }}>
                      {win.prize}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* The text row, as on every bento card. */}
      <div className="relative px-3 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <Label index="00">Kick</Label>
          {givenAway !== null && (
            <span className="font-geist-mono ml-auto flex items-center gap-1.5 text-[10.5px] tabular-nums text-white/45">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KICK_GREEN }} />
              <CountUp value={givenAway} /> given away
            </span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <p className="max-w-sm text-[15px] leading-[23px] text-white/55">
            <span className="font-medium text-white">Watch the stream.</span> Being there is the whole entry — keywords,
            giveaways and winners all happen live.
          </p>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition group-hover:border-white/30 group-hover:bg-white group-hover:text-black">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </a>
  )
}

/** "05h 22m 53s", padded so it does not change width as it ticks; days in front once there are any. */
function Countdown({ left }: { left: { days: number; hours: number; minutes: number; seconds: number } }) {
  const units: [number, string][] = [
    ...(left.days > 0 ? ([[left.days, "d"]] as [number, string][]) : []),
    [left.hours, "h"],
    [left.minutes, "m"],
    ...(left.days > 0 ? [] : ([[left.seconds, "s"]] as [number, string][])),
  ]
  return (
    <span className="inline-flex items-baseline gap-3">
      {units.map(([value, unit]) => (
        <span key={unit}>
          {String(value).padStart(2, "0")}
          <span className="ml-0.5 text-[0.45em] font-medium text-white/35">{unit}</span>
        </span>
      ))}
    </span>
  )
}
