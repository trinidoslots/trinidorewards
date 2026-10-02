"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

export type LegalSection = { id: string; title: string }

/**
 * The document's contents: a sticky list beside the text on wide screens,
 * a fold-out list above it on phones.
 *
 * The heading you are reading is marked, so a long document always says
 * where in it you are.
 */
export function LegalContents({ sections }: { sections: LegalSection[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null)
    if (headings.length === 0) return

    // A heading counts as current once it passes the top fifth of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: "-15% 0px -75% 0px" },
    )
    for (const heading of headings) observer.observe(heading)
    return () => observer.disconnect()
  }, [sections])

  const list = (
    <ol className="space-y-0.5">
      {sections.map((section, index) => {
        const current = section.id === active
        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={() => setOpen(false)}
              className="flex gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-snug transition hover:bg-white/[0.04]"
              style={{ color: current ? "#fff" : "rgba(255,255,255,0.5)" }}
            >
              <span
                className="w-5 shrink-0 text-right tabular-nums"
                style={{ color: current ? ACCENTS.blue : "rgba(255,255,255,0.25)" }}
              >
                {index + 1}
              </span>
              <span className={current ? "font-semibold" : ""}>{section.title}</span>
            </a>
          </li>
        )
      })}
    </ol>
  )

  return (
    <>
      {/* Phones: folded away above the text. */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0E0E12] lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-4 py-3.5"
        >
          <MonoLabel className="text-white/60">Contents</MonoLabel>
          <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div className="border-t border-white/[0.07] p-2">{list}</div>}
      </div>

      {/* Wide screens: beside the text, following it down. */}
      <nav aria-label="Contents" className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block">
        <MonoLabel className="mb-3 block px-2.5 text-white/40">Contents</MonoLabel>
        {list}
      </nav>
    </>
  )
}
