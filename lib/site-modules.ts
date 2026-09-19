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
  advent_calendar: { label: "Advent Calendar", href: "/advent-calendar" },
}

export function readModules(rows: { module_name: string; is_enabled: boolean | null }[]): ModuleStatus {
  const next = { ...ALL_OFF }
  for (const row of rows) {
    const key = moduleKey(String(row.module_name ?? ""))
    if (key) next[key] = row.is_enabled === true
  }
  return next
}

/**
 * The groups the navigation actually draws.
 *
 * These were a hardcoded array inside main-nav.tsx while the admin offered its
 * own unrelated list — "main", "bonus_hunt", "seasonal" — none of which the nav
 * had ever heard of. So the category dropdown wrote a value that nothing read:
 * setting Schedule to "community" left it under Stream, because Stream was
 * spelled out in the component. One list now, used by both.
 *
 * "hidden" is a real choice: a module that is enabled but deliberately not
 * advertised in the nav.
 */
export const NAV_CATEGORIES = [
  { id: "stream", label: "Stream" },
  { id: "bonuses", label: "Bonuses" },
  { id: "community", label: "Community" },
  { id: "hidden", label: "Hidden" },
] as const

export type NavCategory = (typeof NAV_CATEGORIES)[number]["id"]

/** Where each module sits when the row does not say — the nav as it stood. */
export const DEFAULT_CATEGORY: Record<ModuleKey, NavCategory> = {
  stream_store: "stream",
  schedule: "stream",
  active_bonuses: "bonuses",
  claim_bonuses: "bonuses",
  advent_calendar: "bonuses",
  bonus_hunt: "community",
  leaderboard: "community",
  raffles: "community",
  tournaments: "community",
}

/**
 * The order links sit in inside their group.
 *
 * Deliberate rather than whatever order the query returned: grouping by the
 * stored category means the rows arrive in the database's order, and a nav that
 * reshuffles itself because someone re-saved a row is worse than one that is
 * merely wrong. This is the order the hardcoded nav used.
 */
const NAV_ORDER: ModuleKey[] = [
  "stream_store",
  "schedule",
  "active_bonuses",
  "claim_bonuses",
  "advent_calendar",
  "bonus_hunt",
  "leaderboard",
  "raffles",
  "tournaments",
]

const CATEGORY_IDS = new Set<string>(NAV_CATEGORIES.map((entry) => entry.id))

/**
 * The group a module belongs to.
 *
 * An unrecognised stored value falls back to the module's default rather than
 * inventing a group or dropping the link. Rows written before this existed hold
 * things like "main" and "bonus_hunt"; those keep the nav exactly as it was
 * until someone picks a category on purpose.
 */
export function readCategory(key: ModuleKey, stored: string | null | undefined): NavCategory {
  const normalised = (stored ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_")
  return CATEGORY_IDS.has(normalised) ? (normalised as NavCategory) : DEFAULT_CATEGORY[key]
}

export type ModuleRow = { module_name: string; is_enabled: boolean | null; category?: string | null }

/**
 * Enabled modules, grouped and ordered the way the nav draws them.
 *
 * Empty groups are dropped, so turning off both Stream entries removes the
 * heading rather than leaving it over nothing.
 */
export function navGroups(rows: ModuleRow[]): { id: NavCategory; label: string; keys: ModuleKey[] }[] {
  const byCategory = new Map<NavCategory, ModuleKey[]>()

  for (const row of rows) {
    if (!row.is_enabled) continue
    const key = moduleKey(row.module_name)
    if (!key) continue
    const category = readCategory(key, row.category)
    if (category === "hidden") continue
    const list = byCategory.get(category) ?? []
    if (!list.includes(key)) list.push(key)
    byCategory.set(category, list)
  }

  return NAV_CATEGORIES.filter((entry) => entry.id !== "hidden")
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      keys: (byCategory.get(entry.id) ?? []).sort((a, b) => NAV_ORDER.indexOf(a) - NAV_ORDER.indexOf(b)),
    }))
    .filter((group) => group.keys.length > 0)
}
