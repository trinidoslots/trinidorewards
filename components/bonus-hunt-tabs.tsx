"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { HuntRefreshButton } from "@/components/hunt-refresh-button"

type BonusHuntTabsProps = {
  initialTab: "current" | "previous"
  currentContent: ReactNode
  previousContent: ReactNode
}

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
      <section className="mb-8 rounded-3xl border border-cyan-200/15 bg-slate-900/75 p-3 shadow-xl shadow-cyan-950/15 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-2xl border border-slate-700/70 bg-slate-950/50 p-1">
            <button
              type="button"
              onClick={() => switchTab("current")}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                tab === "current"
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-950/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Current Hunt
            </button>
            <button
              type="button"
              onClick={() => switchTab("previous")}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                tab === "previous"
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-950/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Previous Hunts
            </button>
          </div>
          {tab === "current" && (
            <div className="flex items-center gap-3">
              <span className="hidden text-xs uppercase tracking-[0.18em] text-slate-500 sm:block">Live data</span>
              <HuntRefreshButton />
            </div>
          )}
        </div>
      </section>

      <div className="relative">
        <div key="current" className={tab === "current" ? "block animate-in fade-in duration-300" : "hidden"}>
          {currentContent}
        </div>
        <div key="previous" className={tab === "previous" ? "block animate-in fade-in duration-300" : "hidden"}>
          {previousContent}
        </div>
      </div>
    </>
  )
}
