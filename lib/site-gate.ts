import { moduleKey, type ModuleKey } from "@/lib/site-modules"

/**
 * Which public pages the modules table lets people open.
 *
 * Two rules, both enforced in the middleware so a typed-in URL gets the same
 * answer as the nav:
 *
 *   - Maintenance on: every public page goes to /maintenance. The admin panel
 *     stays open to staff (the middleware's own session check still decides
 *     who that is), and so do the things that are not pages for visitors: the
 *     API, the sign-in screens an admin needs to get back in, and the OBS
 *     overlays, which have no login and are live on stream.
 *   - A module switched off: its pages go to the home page. So does
 *     /maintenance itself while maintenance is off.
 *
 * Only a row that says is_enabled = false turns a page off. The nav hides a
 * module with no row at all, but redirecting those too would take pages down
 * the moment a row went missing, which is not something anyone switched.
 *
 * Kept free of next/server so it can be tested on its own.
 */

/** The modules row that switches maintenance mode. Not a nav entry. */
export const MAINTENANCE_MODULE = "maintenance"

export const MAINTENANCE_PATH = "/maintenance"

export type GateState = {
  maintenance: boolean
  /** Modules whose rows all say off. */
  disabled: ReadonlySet<ModuleKey>
}

export const OPEN: GateState = { maintenance: false, disabled: new Set() }

export function readGate(rows: { module_name: string; is_enabled: boolean | null }[]): GateState {
  let maintenance = false
  const off = new Set<ModuleKey>()
  const on = new Set<ModuleKey>()
  for (const row of rows) {
    const name = String(row.module_name ?? "").trim().toLowerCase()
    if (name === MAINTENANCE_MODULE) {
      maintenance = row.is_enabled === true
      continue
    }
    const key = moduleKey(name)
    if (!key) continue
    if (row.is_enabled === false) off.add(key)
    else if (row.is_enabled === true) on.add(key)
  }
  // Two rows can name one key (claim_bonuses and active_bonuses are both
  // bonuses); the page stays open while either is on, as its nav link does.
  const disabled = new Set([...off].filter((key) => !on.has(key)))
  return { maintenance, disabled }
}

/** The pages each module owns, by path prefix. */
const MODULE_PAGES: { path: string; keys: ModuleKey[] }[] = [
  { path: "/store", keys: ["stream_store"] },
  { path: "/bonushunt", keys: ["bonus_hunt"] },
  { path: "/previous-hunts", keys: ["bonus_hunt"] },
  { path: "/raffles", keys: ["raffles"] },
  { path: "/schedule", keys: ["schedule"] },
  { path: "/tournaments", keys: ["tournaments"] },
  { path: "/leaderboard", keys: ["leaderboard"] },
  { path: "/bonuses", keys: ["bonuses"] },
  { path: "/advent-calendar", keys: ["advent_calendar"] },
]

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Open during maintenance. The admin panel is not here: the middleware guards it separately. */
function survivesMaintenance(pathname: string) {
  return (
    under(pathname, "/api") ||
    under(pathname, "/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/__") ||
    under(pathname, "/.well-known") ||
    under(pathname, "/obs") ||
    pathname === "/predictionobs" ||
    pathname === "/random-slot" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest"
  )
}

/**
 * Where a request for a public page should go instead, or null to serve it.
 *
 * Never called for /admin paths.
 */
export function gateRedirect(pathname: string, state: GateState): string | null {
  if (state.maintenance) {
    if (pathname === MAINTENANCE_PATH || survivesMaintenance(pathname)) return null
    return MAINTENANCE_PATH
  }

  if (pathname === MAINTENANCE_PATH) return "/"

  // Longest prefix first, so /bonuses/claim is not decided by /bonuses.
  const page = MODULE_PAGES.filter((entry) => under(pathname, entry.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]
  if (page && page.keys.every((key) => state.disabled.has(key))) return "/"

  return null
}

/*
 * The table, as the middleware last saw it.
 *
 * Kept per server instance and reused for a few seconds, so a busy page does
 * not cost a database round-trip per request. The price is that a switch takes
 * up to REUSE_MS to reach every instance.
 */
const REUSE_MS = 5_000
let last: { at: number; state: GateState } | null = null

/**
 * The current state, read with the anon key (modules is public-read).
 *
 * Any failure keeps the last known state, or leaves the site open if there is
 * none: a database hiccup must not put the whole site into maintenance or
 * take modules away.
 */
export async function currentGate(): Promise<GateState> {
  if (last && Date.now() - last.at < REUSE_MS) return last.state

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return OPEN

  try {
    const response = await fetch(`${url}/rest/v1/modules?select=module_name,is_enabled`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    })
    if (!response.ok) throw new Error(`modules answered ${response.status}`)
    const rows = (await response.json()) as { module_name: string; is_enabled: boolean | null }[]
    last = { at: Date.now(), state: readGate(Array.isArray(rows) ? rows : []) }
  } catch (error) {
    console.error(`[gate] Could not read modules, keeping the last known state: ${error instanceof Error ? error.message : error}`)
    // Try again on the next request rather than hammering on every one.
    last = { at: Date.now() - REUSE_MS + 1_000, state: last?.state ?? OPEN }
  }
  return last.state
}
