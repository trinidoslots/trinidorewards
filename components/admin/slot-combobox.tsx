"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Gamepad2 } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

type Slot = { game_name: string; provider: string | null }

/**
 * Slot picker for the add-participant form.
 *
 * Backed by the `slots` table but deliberately not restricted to it: a battle
 * often runs on something that was added to the casino this week, and being
 * unable to enter it would stop the tournament. Typing a name that is not in
 * the list is accepted as-is; the list only saves keystrokes and keeps the
 * spelling consistent when the game is already known.
 */
export function SlotCombobox({
  value,
  onChange,
  placeholder = "Search slot...",
  id,
}: {
  value: string
  onChange: (name: string, provider: string | null) => void
  placeholder?: string
  id?: string
}) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    createBrowserClient()
      .from("slots")
      .select("game_name, provider")
      .order("game_name")
      .then(({ data, error }) => {
        if (cancelled) return
        // A missing catalogue is survivable — the field still takes free text.
        if (error) console.error("[v0] Could not load slots:", error)
        else setSlots((data ?? []) as Slot[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clicking anywhere else closes the list.
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase()
    const pool = needle
      ? slots.filter(
          (slot) =>
            slot.game_name.toLowerCase().includes(needle) ||
            (slot.provider ?? "").toLowerCase().includes(needle),
        )
      : slots
    return pool.slice(0, 8)
  }, [slots, value])

  function pick(slot: Slot) {
    onChange(slot.game_name, slot.provider)
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <Gamepad2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
      <input
        id={id}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value, null)
          setOpen(true)
          setHighlight(0)
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
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-white/[0.10] bg-[#121216] py-1 shadow-xl shadow-black/60">
          {matches.map((slot, index) => (
            <li key={`${slot.game_name}-${slot.provider}`}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(slot)}
                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[13px] transition ${
                  index === highlight ? "bg-white/[0.07] text-white" : "text-white/70"
                }`}
              >
                <span className="truncate">{slot.game_name}</span>
                {slot.provider && (
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-white/25">
                    {slot.provider}
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
