import type React from "react"

/**
 * The pieces the redesigned pages are built from, first drawn on the landing
 * page: the bracketed monospaced label, the two-tone page intro, and the
 * bento card — an outer frame holding a dot-field "picture" panel and a text
 * row under it. Kept here so every page that moves to the new look uses the
 * same ones rather than a copy that drifts.
 */

/** "[ 01 ] BONUS HUNT" */
export function BracketLabel({
  index,
  children,
  className,
  style,
}: {
  index?: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      className={`font-geist-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40 ${className ?? ""}`}
      style={style}
    >
      {index && <span className="text-white/25">[ {index} ]</span>}
      {children}
    </span>
  )
}

/** A small dot that pings while something is live. */
export function PulseDot({ color, pulse = true }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      {pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-70" style={{ backgroundColor: color }} />}
      <span className="relative h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

/**
 * A page's opening: the label, a headline in two tones (the statement in
 * white, the qualifier in grey), an optional sentence, and whatever sits on
 * the right — a status, a control.
 */
export function PageIntro({
  index = "01",
  label,
  title,
  muted,
  description,
  right,
  children,
}: {
  index?: string
  label: string
  title: React.ReactNode
  muted?: React.ReactNode
  description?: React.ReactNode
  right?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="mx-auto max-w-6xl px-5 pb-10 pt-14 sm:px-8 lg:pb-12 lg:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 max-w-3xl">
          <BracketLabel index={index}>{label}</BracketLabel>
          <h1 className="mt-6 text-[clamp(36px,4.6vw,56px)] font-semibold leading-[1.04] tracking-[-0.045em] text-white">
            {title}
            {muted && (
              <>
                <br />
                <span className="text-white/40">{muted}</span>
              </>
            )}
          </h1>
          {description && <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/50">{description}</p>}
        </div>
        {right}
      </div>
      {children}
    </header>
  )
}

/**
 * The bento card's outer frame: rounded, hairline border, a faint top-down
 * gradient, and the accent only as light from behind on hover.
 */
export function BentoFrame({
  children,
  className,
  glow,
  glowAlways = false,
}: {
  children: React.ReactNode
  className?: string
  glow?: string
  /** Keep the light on at rest, for the one card a page is about. */
  glowAlways?: boolean
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-2 transition duration-300 hover:border-white/[0.16] ${className ?? ""}`}
    >
      {glow && (
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-500 ${
            glowAlways ? "opacity-25 group-hover:opacity-40" : "opacity-0 group-hover:opacity-35"
          }`}
          style={{ backgroundColor: glow }}
        />
      )}
      {children}
    </div>
  )
}

/** The picture inside a bento card: a dot field with the accent lit in one corner. */
export function DotPanel({
  children,
  className,
  glow,
}: {
  children: React.ReactNode
  className?: string
  glow?: string
}) {
  return (
    <div className={`lp-dots relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0d10] ${className ?? ""}`}>
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(70% 80% at 85% 0%, ${glow}24, transparent 70%)` }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

/** The text row under a card's picture: a label on the left, a status on the right, then the body. */
export function CardFooter({
  label,
  index,
  status,
  children,
}: {
  label: string
  index?: string
  status?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="relative px-3 pb-3 pt-4">
      <div className="flex items-center gap-2.5">
        <BracketLabel index={index}>{label}</BracketLabel>
        {status && (
          <span className="font-geist-mono ml-auto flex items-center gap-1.5 text-[10.5px] tabular-nums text-white/45">
            {status}
          </span>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
