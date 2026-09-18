import type { ModuleKey, ModuleStatus } from "@/lib/site-modules"

/**
 * What the landing page is made of.
 *
 * The page used to be a table of contents: six links, six sentences of prose,
 * and two invented numbers ("10K+ members", "6 sections" — a statistic about
 * its own navigation). It linked to a live bonus hunt, a live leaderboard and
 * running raffles and showed nothing from any of them, which is why it read as
 * bare. It was bare. This is the shaping for putting the site's actual state on
 * its front page.
 */

/** A section card. `module` is the switch that decides whether it is offered. */
export type Section = {
  href: string
  code: string
  accent: "amber" | "blue" | "green" | "purple" | "pink" | "red"
  title: string
  copy: string
  module: ModuleKey | null
}

/**
 * Only the sections whose module is switched on.
 *
 * The nav has always respected these; the landing page did not, so it happily
 * advertised a Store or an Advent calendar that the admin had turned off — the
 * same mismatch that once put links on the site for things that were never
 * enabled. `module: null` means the section has no switch and is always there.
 */
export function visibleSections(sections: Section[], modules: ModuleStatus): Section[] {
  return sections.filter((section) => section.module === null || modules[section.module])
}

export type HuntSnapshot = {
  openedBonuses: number
  totalBonuses: number
  startingBalance: number
  currentBalance: number
  bestMultiplier: number
  bestMultiplierGame: string | null
}

/**
 * How far through a hunt is, and whether it is currently up or down.
 *
 * `percent` is clamped: a hunt with no bonuses recorded yet would otherwise
 * divide by zero and render a bar of width NaN, which the browser draws as
 * full.
 */
export function huntProgress(hunt: HuntSnapshot): {
  percent: number
  profit: number
  ahead: boolean
  label: string
} {
  const total = Math.max(0, Number(hunt.totalBonuses) || 0)
  const opened = Math.max(0, Number(hunt.openedBonuses) || 0)
  const percent = total === 0 ? 0 : Math.min(100, Math.round((opened / total) * 100))

  const start = Number(hunt.startingBalance) || 0
  const current = Number(hunt.currentBalance) || 0
  const profit = current - start

  return {
    percent,
    profit,
    ahead: profit >= 0,
    label: total === 0 ? "No bonuses yet" : `${opened} of ${total} opened`,
  }
}
