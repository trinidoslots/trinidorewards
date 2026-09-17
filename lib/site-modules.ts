/**
 * Which navigation entries a `modules` row controls.
 *
 * Shared by the nav and the admin page so there is one answer to "does this row
 * switch that link on". They disagreed before: the seed row is 'tournament',
 * singular, and the nav looked for 'tournaments' — so the Tournaments link
 * stayed hidden no matter what the toggle said, and nothing in the admin panel
 * showed that the two were not connected.
 */

export const MODULE_KEYS = [
  "stream_store",
  "bonus_hunt",
  "raffles",
  "schedule",
  "tournaments",
  "leaderboard",
  "claim_bonuses",
  "active_bonuses",
  "advent_calendar",
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export type ModuleStatus = Record<ModuleKey, boolean>

/** Everything off until a row says otherwise. */
export const ALL_OFF: ModuleStatus = Object.fromEntries(MODULE_KEYS.map((key) => [key, false])) as ModuleStatus

/** Names in the database that do not match their key exactly. */
const ALIASES: Record<string, ModuleKey> = {
  tournament: "tournaments",
  raffle: "raffles",
  store: "stream_store",
  streamstore: "stream_store",
  bonushunt: "bonus_hunt",
  hunt: "bonus_hunt",
  advent: "advent_calendar",
  adventcalendar: "advent_calendar",
  leaderboards: "leaderboard",
}

/** The nav key a module_name controls, or null if it controls nothing. */
export function moduleKey(name: string): ModuleKey | null {
  const normalised = name.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if ((MODULE_KEYS as readonly string[]).includes(normalised)) return normalised as ModuleKey
  if (normalised in ALIASES) return ALIASES[normalised]
  const collapsed = normalised.replace(/_/g, "")
  if (collapsed in ALIASES) return ALIASES[collapsed]
  return null
}

/** What each key turns on, for the admin panel to show alongside the toggle. */
export const MODULE_LINKS: Record<ModuleKey, { label: string; href: string }> = {
  stream_store: { label: "Stream Store", href: "/store" },
  bonus_hunt: { label: "Bonus Hunts", href: "/bonushunt" },
  raffles: { label: "Raffles", href: "/raffles" },
  schedule: { label: "Schedule", href: "/schedule" },
  tournaments: { label: "Tournaments", href: "/tournaments" },
  leaderboard: { label: "Leaderboard", href: "/leaderboard" },
  claim_bonuses: { label: "Claim Bonuses", href: "/bonuses/claim" },
  active_bonuses: { label: "Active Bonuses", href: "/bonuses/active" },
  advent_calendar: { label: "Advent Calendar", href: "/advent" },
}

/** Categories the admin page offers. Free text is still accepted. */
export const MODULE_CATEGORIES = ["main", "bonus_hunt", "community", "seasonal", "hidden"]

export function readModules(rows: { module_name: string; is_enabled: boolean | null }[]): ModuleStatus {
  const next = { ...ALL_OFF }
  for (const row of rows) {
    const key = moduleKey(String(row.module_name ?? ""))
    if (key) next[key] = row.is_enabled === true
  }
  return next
}
