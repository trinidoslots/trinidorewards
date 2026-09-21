"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

/**
 * A copy button for a value that is already shown in full.
 *
 * CopyableId below truncates and is the whole control; this one sits beside
 * text you can already read — a username, a wallet address — for the times you
 * need the exact string rather than to look at it. Selecting a name out of a
 * dense table row by hand is fiddly and easy to get wrong by a character.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string | null | undefined
  /** What is being copied, for the tooltip and for screen readers. */
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  if (!value) return null

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard access can be refused; the value is on screen either way.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : `Copy ${label}`}
      aria-label={`Copy ${label}`}
      className={`inline-flex shrink-0 items-center justify-center rounded p-1 text-white/25 transition hover:bg-white/[0.08] hover:text-white ${className ?? ""}`}
    >
      {copied ? <Check className="h-3 w-3" style={{ color: "#46C48A" }} /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

/**
 * A UUID shown short but copyable in full.
 *
 * Truncated ids were unusable before: you could read "7e19…200a" but not get
 * the actual value out without going to the database. Hovering reveals the
 * whole id, clicking copies it.
 */
export function CopyableId({ value, chars = 4 }: { value: string | null | undefined; chars?: number }) {
  const [copied, setCopied] = useState(false)

  if (!value) return <span className="font-mono text-[11px] text-white/20">—</span>

  const short = value.length > chars * 2 + 1 ? `${value.slice(0, chars)}…${value.slice(-chars)}` : value

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation() // rows are often clickable; copying is not "open"
    event.preventDefault()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard can be blocked; the title attribute still shows the full id.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      aria-label={`Copy id ${value}`}
      className="group/id inline-flex items-center gap-1.5 rounded px-1 py-0.5 font-mono text-[11px] text-white/45 transition hover:bg-white/[0.06] hover:text-white"
    >
      {short}
      {copied ? (
        <Check className="h-3 w-3 text-[#46C48A]" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover/id:opacity-60" />
      )}
    </button>
  )
}
