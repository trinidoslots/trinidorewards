"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { HuntRefreshButton } from "@/components/hunt-refresh-button"
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
  // The previous-hunts panel mounts the first time it is opened, then stays.
  // Mounting it up front meant every visit to the live hunt also loaded every
  // ended hunt and the first one's bonuses, in a tab nobody had opened.
  const [previousOpened, setPreviousOpened] = useState(initialTab === "previous")

  const switchTab = (next: "current" | "previous") => {
    if (next === tab) return
    setTab(next)
    if (next === "previous") setPreviousOpened(true)
    const url = next === "current" ? "/bonushunt" : "/bonushunt?tab=previous"
    window.history.replaceState(null, "", url)
  }

  return (
    <>
      {/* A pill switch, as on the landing page's buttons: the active one
          filled white, the other quiet. */}
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {TABS.map(({ id, label }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={`h-9 rounded-full px-4 text-[13.5px] font-medium transition ${
                  active ? "bg-white text-black" : "text-white/50 hover:text-white"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {tab === "current" && (
          <div className="ml-auto flex items-center gap-2.5">
            <span className="font-geist-mono hidden text-[10.5px] uppercase tracking-[0.14em] text-white/30 sm:block">Live data</span>
            <HuntRefreshButton />
          </div>
        )}
      </div>

      {/* Once opened, both panels stay mounted — the previous-hunts panel
          fetches on mount, and remounting it on every switch back would refetch. Swap replays
          the entry animation and eases the height, which is the part that was
          missing: the fade was already running, but the container snapped
          between the two panels' heights in one frame and swallowed it. */}
      <Swap on={tab}>
        <div className={tab === "current" ? "block" : "hidden"}>{currentContent}</div>
        <div className={tab === "previous" ? "block" : "hidden"}>{previousOpened ? previousContent : null}</div>
      </Swap>
    </>
  )
}
