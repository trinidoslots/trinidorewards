import type React from "react"

/**
 * The shared surface language, taken from the weekly-board view: near-black
 * ground, thin hairline borders, monospaced uppercase labels, and one coloured
 * edge per card instead of filled blocks of colour. Dense and quiet — the
 * numbers carry the page, not the chrome.
 */

export const ACCENTS = {
  blue: "#5B8DEF",
  green: "#46C48A",
  amber: "#E8A33D",
  purple: "#A78BFA",
  pink: "#E8629B",
  red: "#E5484D",
  slate: "#6B7280",
} as const

export type Accent = keyof typeof ACCENTS

/** Small uppercase monospace label — the board's workhorse for metadata. */
export function MonoLabel({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      className={`font-mono text-[10px] uppercase leading-none tracking-[0.12em] ${className ?? ""}`}
      style={style}
    >
      {children}
    </span>
  )
}

/** A hairline-bordered surface, optionally with a coloured left edge. */
export function Panel({
  accent,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { accent?: Accent }) {
  return (
    <div
      {...rest}
      className={`rounded-lg border border-white/[0.08] bg-white/[0.022] ${className ?? ""}`}
      style={{
        ...(accent ? { borderLeft: `2px solid ${ACCENTS[accent]}` } : null),
        ...rest.style,
      }}
    >
      {children}
    </div>
  )
}

export function PanelHeader({
  title,
  right,
  accent = "blue",
}: {
  title: string
  right?: React.ReactNode
  accent?: Accent
}) {
  return (
    <header className="flex items-center gap-2 border-b border-white/[0.08] px-3.5 py-2.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENTS[accent] }} />
      <MonoLabel className="text-white/70">{title}</MonoLabel>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </header>
  )
}

/** Big number, small caption — the row of tiles across the top of the board. */
export function StatTile({
  label,
  value,
  accent,
  hint,
}: {
  label: string
  value: React.ReactNode
  accent?: Accent
  hint?: string
}) {
  return (
    <div
      className="rounded-lg border border-white/[0.08] bg-white/[0.022] px-4 py-3.5"
      style={accent ? { borderColor: `${ACCENTS[accent]}44` } : undefined}
    >
      <p
        className="text-[26px] font-semibold leading-none tabular-nums tracking-tight"
        style={{ color: accent ? ACCENTS[accent] : "#E7E7EA" }}
      >
        {value}
      </p>
      <MonoLabel className="mt-2 block text-white/40">{label}</MonoLabel>
      {hint && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
    </div>
  )
}

/** Status chip, e.g. Live / Done / In Progress. */
export function Tag({ children, accent = "slate" }: { children: React.ReactNode; accent?: Accent }) {
  const color = ACCENTS[accent]
  return (
    <span
      className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] uppercase leading-none tracking-[0.08em]"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {children}
    </span>
  )
}
