"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"

/**
 * The board's own dropdown, and the field styling that goes with it.
 *
 * A native <select> renders its list with the operating system's widget: light
 * grey on Windows, a different metric on every platform, and nothing about it
 * can be styled. Next to the near-black panels and hairline borders everywhere
 * else it read as a piece of a different program.
 *
 * The menu is portalled to document.body and positioned from the trigger's
 * rect rather than being absolutely placed inside it. Two reasons, both real
 * here: the buy dialog scrolls its own body, which would clip a menu rendered
 * inside it, and a `transform` anywhere up the tree — Panel's `lift` class sets
 * one — turns that ancestor into the containing block for anything fixed.
 */

/** The shared look for anything you type into, so inputs and selects match. */
export const FIELD_CLASS =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white " +
  "outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-white/30"

export type SelectOption = {
  value: string
  label: string
  /** Second line, for the things a label alone cannot say. */
  hint?: string
  disabled?: boolean
}

type Position = { top: number; left: number; width: number; placement: "below" | "above" }

const MENU_GAP = 4
const MAX_MENU_HEIGHT = 280

export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [active, setActive] = useState(0)
  const [mounted, setMounted] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const selected = options.find((option) => option.value === value) ?? null

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom
    const above = rect.top
    // Flip up only when there is genuinely more room there, so a field near the
    // bottom of a dialog does not open into nothing.
    const placement = below < Math.min(MAX_MENU_HEIGHT, 200) && above > below ? "above" : "below"

    setPosition({
      top: placement === "below" ? rect.bottom + MENU_GAP : rect.top - MENU_GAP,
      left: rect.left,
      width: rect.width,
      placement,
    })
  }, [])

  // Measured before paint, so the menu never appears at the wrong place for a
  // frame and then jumps.
  useLayoutEffect(() => {
    if (!open) return
    place()
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
  }, [open, place, options, value])

  useEffect(() => {
    if (!open) return

    const reposition = () => place()
    // `true` so a scroll inside the dialog counts, not just the window's.
    window.addEventListener("scroll", reposition, true)
    window.addEventListener("resize", reposition)

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)

    return () => {
      window.removeEventListener("scroll", reposition, true)
      window.removeEventListener("resize", reposition)
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [open, place])

  const choose = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === "Tab") {
      setOpen(false)
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      const option = options[active]
      if (option) choose(option)
      return
    }

    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
    if (step === 0) return
    event.preventDefault()

    // Skips disabled entries rather than landing on one and doing nothing.
    let next = active
    for (let i = 0; i < options.length; i++) {
      next = (next + step + options.length) % options.length
      if (!options[next].disabled) break
    }
    setActive(next)
  }

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`${FIELD_CLASS} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${className ?? ""}`}
        style={open ? { borderColor: `${ACCENTS.blue}77` } : undefined}
      >
        <span className={`truncate ${selected ? "text-white" : "text-white/30"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>

      {mounted &&
        open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[100] overflow-y-auto overflow-x-hidden rounded-md border border-white/[0.12] bg-[#121216] p-1 shadow-2xl shadow-black/60"
            style={{
              top: position.placement === "below" ? position.top : undefined,
              bottom: position.placement === "above" ? window.innerHeight - position.top : undefined,
              left: position.left,
              width: position.width,
              maxHeight: MAX_MENU_HEIGHT,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value
              const isActive = index === active
              return (
                <button
                  key={option.value || `empty-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => !option.disabled && setActive(index)}
                  onClick={() => choose(option)}
                  className="flex w-full items-start gap-2 rounded px-2.5 py-2 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-30"
                  style={{
                    backgroundColor: isActive && !option.disabled ? "rgba(255,255,255,0.06)" : "transparent",
                    color: isSelected ? "#fff" : "rgba(255,255,255,0.65)",
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="mt-0.5 block truncate text-[11px] text-white/30">{option.hint}</span>
                    )}
                  </span>
                  {isSelected && (
                    <Check className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.blue }} />
                  )}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
