"use client"

import Link from "next/link"
import { ArrowUpRight, Play } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { LiveDot } from "@/components/landing-blocks"

/**
 * The hero.
 *
 * Scaled up from the board language, not away from it. The first version of
 * this went off on its own: a brand green that is not in the palette, a
 * two-colour gradient across the headline, and six blurred colour blobs — the
 * "filled blocks of colour" the shared surface language exists to avoid.
 *
 * What makes this read as a hero rather than a card is size and space: display
 * type, a tall band, an asymmetric split. Colour does none of that work. The
 * ground stays near-black, the texture is achromatic, and the only chroma on
 * the screen is one accent on the status dot and one on the figure that
 * deserves it.
 */

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
    // Fills the content column rather than the viewport. The 50vw full-bleed
    // trick is wrong here: the site's wrapper is already inset by the width of
    // the nav, so half a viewport measured from this element's centre lands
    // past the right edge — measured, 1385px of content in a 1280px window.
    <section className="relative w-full overflow-hidden border-b border-white/[0.06] bg-[#08080A]">
      {/* Texture, not colour: a grid in plain white at very low alpha. */}
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-70" />
      {/* One wash, achromatic, just enough to stop the corner going flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[15%] -top-[40%] h-[760px] w-[760px] rounded-full opacity-[0.05] blur-[120px]"
        style={{ background: "#FFFFFF" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(to bottom, transparent, #0B0B0D)" }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-32 lg:pt-28">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.10] bg-white/[0.03] px-3.5 py-1.5">
            {status.live ? (
              <LiveDot color={ACCENTS.red} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
            )}
            <MonoLabel style={{ color: status.live ? ACCENTS.red : "rgba(255,255,255,0.55)" }}>
              {status.label}
            </MonoLabel>
            {status.detail && <span className="text-[12px] text-white/40">{status.detail}</span>}
          </div>

          {/*
            Two words stacked, sized off the viewport so the headline carries
            the same weight on a phone as on a desktop. The second is set in a
            white-to-transparent gradient — tonal depth rather than a second
            colour, which is what a gradient of two accents was.
          */}
          <h1 className="mt-6 font-black uppercase leading-[0.88] tracking-[-0.03em]">
            <span className="block text-[clamp(46px,10vw,104px)] text-white">Trinido</span>
            <span
              className="text-gradient block text-[clamp(46px,10vw,104px)]"
              style={{ backgroundImage: "linear-gradient(100deg, #FFFFFF, rgba(255,255,255,0.32))" }}
            >
              Rewards
            </span>
          </h1>

          <p className="mt-7 max-w-md text-[15px] leading-7 text-white/45">
            Bonus hunts, leaderboards, raffles and tournaments — all running alongside the stream, all free to take
            part in.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {/* The primary action, in the panel language's own primary
                treatment — a tinted hairline, not a filled button. */}
            <a
              href={kickUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lift inline-flex items-center gap-2 rounded-lg border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.1em]"
              style={{
                borderColor: `${ACCENTS.blue}77`,
                backgroundColor: `${ACCENTS.blue}1f`,
                color: ACCENTS.blue,
              }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Watch on Kick
            </a>
            {primary && (
              <Link
                href={primary.href}
                className="lift inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.05] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-white"
              >
                {primary.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {givenAway && (
            <div className="mt-10 flex items-baseline gap-3">
              {/* The one figure on the page worth a colour, in the palette's
                  own green rather than a brand one. */}
              <span
                className="text-[34px] font-black leading-none tabular-nums tracking-tight sm:text-[42px]"
                style={{ color: ACCENTS.green }}
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
