import type React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

/**
 * The frame around the admin sign-in screens.
 *
 * These were the last pages still wearing the v0 slate gradient, which put a
 * different site in front of you on the way into the admin panel. One shell
 * for all three means the next change lands on all three.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0B0D] p-6">
      {/* One soft wash behind the card, so the panel is not floating on flat
          black. Pointer-events off: it spans the viewport. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07] blur-[90px]"
        style={{ background: ACCENTS.blue }}
      />

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white/35 transition hover:text-white/70"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the site
        </Link>

        <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.022]">
          <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENTS.blue }} />
            <MonoLabel className="text-white/70">{title}</MonoLabel>
          </header>

          <div className="p-5">
            <p className="mb-5 text-[13px] leading-relaxed text-white/40">{subtitle}</p>
            {children}
          </div>

          {footer && (
            <footer className="border-t border-white/[0.08] px-5 py-3.5 text-center text-[12px] text-white/35">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  )
}

/** A labelled field, in the panel language: mono caption over a hairline input. */
export function Field({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>
      <input
        {...input}
        className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/20 focus:border-white/25"
      />
    </label>
  )
}

/** The one primary action on these screens. */
export function SubmitButton({
  children,
  busy,
  disabled,
}: {
  children: React.ReactNode
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="h-9 w-full rounded-md border font-mono text-[11px] uppercase tracking-[0.1em] transition disabled:opacity-50"
      style={{ borderColor: `${ACCENTS.blue}77`, backgroundColor: `${ACCENTS.blue}1f`, color: ACCENTS.blue }}
    >
      {children}
    </button>
  )
}

/** Failures are stated where they happened, in the panel's own red. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      className="rounded-md border px-3 py-2 text-[12px]"
      style={{ borderColor: `${ACCENTS.red}44`, backgroundColor: `${ACCENTS.red}14`, color: ACCENTS.red }}
    >
      {message}
    </p>
  )
}
