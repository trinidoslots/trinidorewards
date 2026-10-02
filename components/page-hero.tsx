"use client"

import type React from "react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import type { Countdown } from "@/components/leaderboard-board"
import { Clock } from "@/components/landing/parts"

/**
 * The band at the top of a page, in the landing page's language.
 *
 * Left-aligned display title with an accent rule and label above it, the
 * same accent as a wash in the top-right corner over the masked grid, and —
 * when the page has one — the figure it is about and its countdown in a panel
 * on the right. The landing hero and every section heading on it are built
 * the same way, so moving from the home page into a section reads as going
 * deeper into one site rather than into a different template.
 *
 * Only the accent changes between pages.
 */
export function PageHero({
  accent = "blue",
  figure,
  figureLabel,
  title,
  subtitle,
  note,
  actions,
  switcher,
  countdown,
  countdownLabel,
  range,
  aside,
  wide = false,
  children,
}: {
  accent?: Accent
  /** The number the page is about, if it has one. */
  figure?: React.ReactNode
  figureLabel?: string
  title: string
  subtitle?: string | null
  /** A short status above the title — "Live", "Next stream", "Drawn". */
  note?: string
  actions?: React.ReactNode
  /** A control. Sits above everything, because a control must not move. */
  switcher?: React.ReactNode
  countdown?: Countdown
  countdownLabel?: string
  range?: string
  /** Custom content for the right-hand panel, in place of a figure or countdown. */
  aside?: React.ReactNode
  /** The wider page width, for a page whose content needs it (the schedule's week). */
  wide?: boolean
  children?: React.ReactNode
}) {
  const color = ACCENTS[accent]
  const hasPanel = figure !== undefined || !!countdown || !!aside
  // Raffle names and schedule dates arrive here as titles; a long one at full
  // display size would wrap into four lines.
  const long = title.length > 22

  return (
    // data-no-reveal: pages render this header in their loading state and
    // again once loaded. Staged by <Reveal>, it animated in twice — once as
    // the placeholder, once more when the real page replaced it. The page
    // transition already brings it in; it should then stay put.
    <section data-no-reveal className="relative w-full overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(900px 420px at 85% -20%, ${color}24, transparent 62%), #08080A` }}
      />
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-0"
        style={{
          maskImage: "radial-gradient(ellipse 70% 90% at 70% 0%, #000 25%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 90% at 70% 0%, #000 25%, transparent 75%)",
        }}
      />

      <div
        className={`relative mx-auto grid ${wide ? "max-w-7xl" : "max-w-6xl"} gap-10 px-5 pb-12 pt-10 lg:px-8 lg:pb-16 lg:pt-14 ${
          hasPanel ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-end" : ""
        }`}
      >
        <div className="min-w-0">
          {switcher && <div className="mb-7">{switcher}</div>}

          <div className="flex items-center gap-2.5">
            <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: color }} />
            <MonoLabel style={{ color }}>{note ?? "TrinidoRewards"}</MonoLabel>
          </div>

          <h1
            className={`mt-4 break-words font-black uppercase leading-[0.92] tracking-[-0.01em] text-white ${
              long ? "text-[clamp(30px,4.6vw,52px)]" : "text-[clamp(40px,6.4vw,76px)]"
            }`}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/50">{subtitle}</p>}

          {actions && <div className="mt-6 flex flex-wrap items-center gap-2.5">{actions}</div>}

          {children}

          {!hasPanel && range && <p className="mt-5 text-[12.5px] text-white/35">{range}</p>}
        </div>

        {hasPanel && (
          <div className="relative overflow-hidden rounded-xl border border-white/[0.10] bg-[#0E0E12]/90 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur sm:p-7">
            {figure !== undefined && (
              <div className={countdown ? "border-b border-white/[0.07] pb-6" : ""}>
                <MonoLabel style={{ color }}>{figureLabel ?? "Total"}</MonoLabel>
                <p className="mt-3 text-[clamp(40px,5vw,56px)] font-black leading-none tabular-nums tracking-[-0.02em] text-white">
                  {figure}
                </p>
              </div>
            )}
            {countdown && (
              <div className={figure !== undefined ? "pt-6" : ""}>
                <MonoLabel className="mb-4 block text-white/45">
                  {countdown.over ? "Closed" : (countdownLabel ?? "Time remaining")}
                </MonoLabel>
                <Clock left={countdown} accent={color} />
                {range && <p className="mt-4 text-[12.5px] text-white/35">{range}</p>}
              </div>
            )}
            {!countdown && range && <p className="mt-4 text-[12.5px] text-white/35">{range}</p>}
            {aside}
          </div>
        )}
      </div>
    </section>
  )
}

/** The container the content below a hero sits in. */
export function PageBody({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode
  className?: string
  /** Matches PageHero's wide, so the two keep the same edges. */
  wide?: boolean
}) {
  return (
    <div className={`mx-auto ${wide ? "max-w-7xl" : "max-w-6xl"} px-5 py-10 lg:px-8 ${className ?? ""}`}>{children}</div>
  )
}

/**
 * PageHero's own shape with placeholders, for pages that load in the browser.
 *
 * A loading state that renders a real PageHero with a stand-in title ("Loading",
 * or the section name) is replaced a moment later by one with the real title —
 * one header swapped for another. This keeps the edges where the real header
 * will put them, so loading reads as the same header filling in.
 */
export function PageHeroSkeleton({
  accent = "blue",
  panel = false,
  top,
  children,
  panelContent,
  subtitle = true,
  wide = false,
}: {
  accent?: Accent
  panel?: boolean
  /** Placeholder for what the page puts above the title (the profile's avatar). */
  top?: React.ReactNode
  /** Placeholder for what the page puts under the subtitle (the profile's stats). */
  children?: React.ReactNode
  /** The panel's own placeholder shape, instead of one plain block. */
  panelContent?: React.ReactNode
  /** Off for a page whose header has no subtitle, so loading does not shift it. */
  subtitle?: boolean
  wide?: boolean
}) {
  const color = ACCENTS[accent]
  return (
    <section data-no-reveal className="relative w-full overflow-hidden border-b border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(900px 420px at 85% -20%, ${color}24, transparent 62%), #08080A` }}
      />
      <div
        className={`relative mx-auto grid ${wide ? "max-w-7xl" : "max-w-6xl"} gap-10 px-5 pb-12 pt-10 lg:px-8 lg:pb-16 lg:pt-14 ${
          panel ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-end" : ""
        }`}
      >
        <div>
          {top && <div className="mb-7">{top}</div>}
          <span className="block h-[3px] w-6 rounded-full" style={{ backgroundColor: color }} />
          <div className="mt-5 h-[clamp(36px,5.6vw,66px)] w-4/5 max-w-xl animate-pulse rounded-lg bg-white/[0.06]" />
          {subtitle && <div className="mt-5 h-3.5 w-72 max-w-full animate-pulse rounded bg-white/[0.05]" />}
          {children}
        </div>
        {panel &&
          (panelContent ? (
            <div className="rounded-xl border border-white/[0.10] bg-[#0E0E12]/90 p-6 sm:p-7">{panelContent}</div>
          ) : (
            <div className="h-[150px] animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]" />
          ))}
      </div>
    </section>
  )
}
