"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Info } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { infoFingerprint, type ScheduleInfo } from "@/lib/schedule-info"

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const FOLDED_KEY = "schedule-info-folded"

/**
 * The info text above the schedule, opened or folded by the visitor.
 *
 * Open by default. Folding it is remembered for that text: when the text is
 * changed in the admin, it opens again, since it is news.
 */
export function ScheduleInfoBox({ info }: { info: ScheduleInfo }) {
  const fingerprint = infoFingerprint(info)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(FOLDED_KEY) !== fingerprint)
    } catch {
      // Storage refused: it just starts open every time.
    }
  }, [fingerprint])

  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      if (next) window.localStorage.removeItem(FOLDED_KEY)
      else window.localStorage.setItem(FOLDED_KEY, fingerprint)
    } catch {
      // As above.
    }
  }

  const color = ACCENTS.purple

  return (
    <section
      className="overflow-hidden rounded-xl border bg-[#0E0E12]"
      style={{ borderColor: open ? `${color}44` : "rgba(255,255,255,0.08)" }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          <Info className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-white">{info.title}</span>
        <span className="hidden text-[12.5px] text-white/40 sm:inline">{open ? "Hide" : "Show"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <p className="whitespace-pre-line border-t border-white/[0.07] px-5 py-4 text-[14px] leading-relaxed text-white/65">
              {info.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
