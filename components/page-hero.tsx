"use client"

import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import { CountdownTiles, type Countdown } from "@/components/leaderboard-board"

/**
 * The band at the top of a page, taken from the leaderboard.
 *
 * Every other page opened with the same small left-aligned line — a 24px
 * heading and a sentence — which gives a page no first beat at all. The
 * leaderboard's works because of three things: a dark band that runs the full
 * width and curves out of the page at the bottom, one figure set large enough
 * to be the reason you came, and everything centred so the eye starts in the
 * middle rather than at a margin.
 *
 * Only the wash colour changes between pages. That is what makes them read as
 * one site rather than as a template applied twice.
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
  children,
}: {
  accent?: Accent
  /** The number the page is about, if it has one. */
  figure?: React.ReactNode
  figureLabel?: string
  title: string
  subtitle?: string | null
  /** A quiet line under the title — what the page is ranked or sorted by. */
  note?: string
  actions?: React.ReactNode
  /** A control. Sits above everything, because a control must not move. */
  switcher?: React.ReactNode
  countdown?: Countdown
  countdownLabel?: string
  range?: string
  children?: React.ReactNode
}) {
  const color = ACCENTS[accent]

  return (
    <section className="relative overflow-hidden rounded-b-[40px] border-b border-white/[0.06] bg-[#0E0E12] px-5 pb-12 pt-10 text-center sm:px-8 sm:pb-14">
      {/* One wash behind the figure. Sits under everything and takes no clicks. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] max-w-none -translate-x-1/2 opacity-[0.10]"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}, transparent 65%)` }}
      />

      <div className="relative mx-auto max-w-5xl">
        {switcher && <div className="mb-6 flex justify-center">{switcher}</div>}

        {figure !== undefined && (
          <p
            className="text-[44px] font-bold leading-none tracking-tight tabular-nums sm:text-[60px]"
            style={{ color }}
          >
            {figure}
          </p>
        )}
        {figureLabel && <MonoLabel className="mt-2.5 block text-white/35">{figureLabel}</MonoLabel>}

        <h1
          className={`text-[17px] font-bold uppercase italic tracking-wide text-white sm:text-[22px] ${
            figure !== undefined || figureLabel ? "mt-4" : ""
          }`}
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[12.5px] text-white/35">{subtitle}</p>}
        {note && <MonoLabel className="mt-2 block text-white/25">{note}</MonoLabel>}

        {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}

        {children}

        {countdown && (
          <div className="mt-10">
            <MonoLabel className="mb-3 block text-white/30">
              {countdown.over ? "Closed" : (countdownLabel ?? "Time remaining")}
            </MonoLabel>
            <CountdownTiles left={countdown} />
            {range && <p className="mt-3 text-[11.5px] text-white/25">{range}</p>}
          </div>
        )}
        {!countdown && range && <p className="mt-6 text-[11.5px] text-white/25">{range}</p>}
      </div>
    </section>
  )
}

/** The container the content below a hero sits in. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`mx-auto max-w-6xl px-5 py-8 lg:px-8 ${className ?? ""}`}>{children}</div>
}
