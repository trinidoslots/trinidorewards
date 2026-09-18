"use client"

import Link from "next/link"
import { ArrowUpRight, Play } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { LiveDot } from "@/components/landing-blocks"

/**
 * The hero.
 *
 * Deliberately not a Panel. The rest of the site is the board language — small
 * type, hairlines, everything the same weight — which is right for reading
 * numbers and wrong for the first screen someone ever sees. This one is
 * full-bleed, tall, and built out of layers: a grid texture so a large dark
 * area reads as material rather than as an empty rectangle, two soft washes for
 * depth, and display type big enough to be the only thing on the screen.
 */

const KICK_GREEN = "#53FC18"

export function Hero({
  status,
  givenAway,
  primary,
  kickUrl,
  aside,
}: {
  status: { live: boolean; label: string; detail?: string }
  givenAway: string | null
  primary?: { href: string; label: string }
  kickUrl: string
  aside?: React.ReactNode
}) {
  return (
    // Fills the content column rather than the viewport. The 50vw
    // full-bleed trick is wrong here: the site's wrapper is already inset by
    // the width of the nav, so half a viewport measured from this element's
    // centre lands past the right edge — measured, 1385px of content in a
    // 1280px window. The page root has no max width, so w-full is the whole
    // width that is actually available.
    <section className="relative w-full overflow-hidden bg-[#08080A]">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[10%] -top-[35%] h-[780px] w-[780px] rounded-full opacity-[0.16] blur-[110px]"
        style={{ background: ACCENTS.blue }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[45%] right-[-8%] h-[720px] w-[720px] rounded-full opacity-[0.13] blur-[110px]"
        style={{ background: ACCENTS.amber }}
      />
      {/* Bottom fade, so the band dissolves into the page instead of ending. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(to bottom, transparent, #0B0B0D)" }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-32 lg:pt-28">
        <div>
          <div
            className="inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5"
            style={{
              borderColor: status.live ? `${ACCENTS.red}44` : "rgba(255,255,255,0.10)",
              backgroundColor: status.live ? `${ACCENTS.red}12` : "rgba(255,255,255,0.03)",
            }}
          >
            {status.live ? (
              <LiveDot color={ACCENTS.red} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            )}
            <MonoLabel style={{ color: status.live ? ACCENTS.red : "rgba(255,255,255,0.55)" }}>
              {status.label}
            </MonoLabel>
            {status.detail && <span className="text-[12px] text-white/40">{status.detail}</span>}
          </div>

          {/*
            Two words, stacked, sized off the viewport so the headline is the
            same weight of statement on a phone as on a desktop. The second
            carries the gradient — one painted word reads as deliberate, two
            read as a effect.
          */}
          <h1 className="mt-6 font-black uppercase leading-[0.88] tracking-[-0.03em] text-white">
            <span className="block text-[clamp(46px,10vw,104px)]">Trinido</span>
            <span
              className="text-gradient block text-[clamp(46px,10vw,104px)]"
              style={{ backgroundImage: `linear-gradient(100deg, ${ACCENTS.amber}, ${KICK_GREEN})` }}
            >
              Rewards
            </span>
          </h1>

          <p className="mt-7 max-w-md text-[15px] leading-7 text-white/45">
            Bonus hunts, leaderboards, raffles and tournaments — all running alongside the stream, all free to take
            part in.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href={kickUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lift inline-flex items-center gap-2 rounded-lg px-5 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#08080A]"
              style={{ backgroundColor: KICK_GREEN, boxShadow: `0 8px 30px -10px ${KICK_GREEN}` }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Watch on Kick
            </a>
            {primary && (
              <Link
                href={primary.href}
                className="lift inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.05] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-white backdrop-blur"
              >
                {primary.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {givenAway && (
            <div className="mt-10 flex items-baseline gap-3">
              <span
                className="text-[34px] font-black leading-none tabular-nums tracking-tight sm:text-[42px]"
                style={{ color: KICK_GREEN }}
              >
                {givenAway}
              </span>
              <MonoLabel className="text-white/30">Given away so far</MonoLabel>
            </div>
          )}
        </div>

        {aside && <div className="lg:pl-4">{aside}</div>}
      </div>
    </section>
  )
}
