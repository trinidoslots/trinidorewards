"use client"

import { useEffect, useRef, useState } from "react"
import { Gamepad2, Loader2 } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatProvider } from "@/lib/providers"

export type SlotPick = { game_name: string; provider: string | null; image_url?: string | null }

/**
 * Slot picker: type part of a name, pick from the catalogue.
 *
 * Searches the `slots` table as you type rather than loading it up front. It
 * used to load the table once — which PostgREST caps at 1000 rows, so with the
 * full Stake catalogue (several thousand) most slots could never be found.
 *
 * Not restricted to the catalogue: a battle or a hunt often runs on something
 * added to the casino this week, so a name that is not in the list is accepted
 * as typed. The list saves keystrokes, keeps the spelling consistent, and hands
 * over the provider and artwork when the game is known.
 */
export function SlotCombobox({
  value,
  onChange,
  placeholder = "Search slot...",
  id,
  autoFocus,
}: {
  value: string
  onChange: (name: string, provider: string | null, imageUrl?: string | null) => void
  placeholder?: string
  id?: string
  autoFocus?: boolean
}) {
  const [matches, setMatches] = useState<SlotPick[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createBrowserClient())

  // Debounced search. Names first (what people type), then providers.
  useEffect(() => {
    const needle = value.trim()
    if (!open || needle.length < 2) {
      setMatches([])
      return
    }
    let cancelled = false
    setBusy(true)
    const timer = setTimeout(async () => {
      // "%" and "_" are wildcards in ILIKE; a name containing them should match itself.
      // Quoted, because a name may contain the commas and brackets .or() splits on.
      const pattern = `"%${needle.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/"/g, '\\"')}%"`
      const { data, error } = await supabaseRef.current
        .from("slots")
        // "*" so the artwork comes along once scripts/077 has added it.
        .select("*")
        .or(`game_name.ilike.${pattern},provider.ilike.${pattern}`)
        .order("game_name")
        .limit(12)
      if (cancelled) return
      setBusy(false)
      // A missing catalogue is survivable — the field still takes free text.
      if (error) console.error("[v0] Could not search slots:", error)
      else {
        const rows = (data ?? []) as SlotPick[]
        const lower = needle.toLowerCase()
        // Names that start with what was typed first.
        rows.sort(
          (a, b) =>
            Number(!a.game_name.toLowerCase().startsWith(lower)) - Number(!b.game_name.toLowerCase().startsWith(lower)),
        )
        setMatches(rows)
        setHighlight(0)
      }
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, open])

  // Clicking anywhere else closes the list.
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  function pick(slot: SlotPick) {
    onChange(slot.game_name, formatProvider(slot.provider), slot.image_url ?? null)
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      {busy ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-white/30" />
      ) : (
        <Gamepad2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
      )}
      <input
        id={id}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value, null, null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open || matches.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlight((index) => (index + 1) % matches.length)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlight((index) => (index - 1 + matches.length) % matches.length)
          } else if (event.key === "Enter") {
            // Only steal Enter when a suggestion is actually highlighted,
            // otherwise a free-text name could never be submitted.
            event.preventDefault()
            pick(matches[highlight])
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
        className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
      />

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-white/[0.10] bg-[#121216] py-1 shadow-xl shadow-black/60">
          {matches.map((slot, index) => (
            <li key={`${slot.game_name}-${slot.provider}`}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(slot)}
                className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[13px] transition ${
                  index === highlight ? "bg-white/[0.07] text-white" : "text-white/70"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-white/[0.03]">
                  {slot.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external slot artwork
                    <img src={slot.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Gamepad2 className="h-3.5 w-3.5 text-white/20" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{slot.game_name}</span>
                {slot.provider && (
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-white/25">
                    {formatProvider(slot.provider)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
