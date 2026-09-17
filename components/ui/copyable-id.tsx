"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

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
