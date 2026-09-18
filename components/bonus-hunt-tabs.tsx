"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { HuntRefreshButton } from "@/components/hunt-refresh-button"
import { MonoLabel } from "@/components/ui/panel"
import { Swap } from "@/components/swap"

type BonusHuntTabsProps = {
  initialTab: "current" | "previous"
  currentContent: ReactNode
  previousContent: ReactNode
}

const TABS = [
  { id: "current", label: "Current hunt" },
  { id: "previous", label: "Previous hunts" },
] as const

export function BonusHuntTabs({ initialTab, currentContent, previousContent }: BonusHuntTabsProps) {
  const [tab, setTab] = useState<"current" | "previous">(initialTab)

  const switchTab = (next: "current" | "previous") => {
    if (next === tab) return
    setTab(next)
    const url = next === "current" ? "/bonushunt" : "/bonushunt?tab=previous"
    window.history.replaceState(null, "", url)
  }

  return (
    <>
      {/* An underline rail rather than a pill group — quieter, and it reads as
          part of the page instead of a control floating on top of it. */}
      <div className="mb-5 flex items-center gap-6 border-b border-white/[0.08]">
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              className={`-mb-px border-b px-0.5 pb-2.5 text-[13px] transition ${
                active
                  ? "border-[#5B8DEF] text-white"
                  : "border-transparent text-white/35 hover:text-white/70"
              }`}
            >
              {label}
            </button>
          )
        })}

        {tab === "current" && (
          <div className="ml-auto flex items-center gap-2.5 pb-2">
            <MonoLabel className="hidden text-white/25 sm:block">Live data</MonoLabel>
            <HuntRefreshButton />
          </div>
        )}
      </div>

      {/* Both panels stay mounted — the previous-hunts panel fetches on mount,
          and remounting it on every switch back would refetch. Swap replays
          the entry animation and eases the height, which is the part that was
          missing: the fade was already running, but the container snapped
          between the two panels' heights in one frame and swallowed it. */}
      <Swap on={tab}>
        <div className={tab === "current" ? "block" : "hidden"}>{currentContent}</div>
        <div className={tab === "previous" ? "block" : "hidden"}>{previousContent}</div>
      </Swap>
    </>
  )
}
