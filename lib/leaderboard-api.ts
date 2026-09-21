/**
 * The external wager feed, behind a neutral model.
 *
 * Nothing outside this file knows the provider's field names, its host or its
 * error vocabulary. Callers get `LeaderboardStanding[]` and, when something goes
 * wrong, a `LeaderboardApiError` carrying a message that is safe to show.
 *
 * Follows lib/bonushunt-api.ts, which is how this codebase already talks to an
 * external API: TTL cache in module memory, one retry on 429 honouring
 * retry-after, a typed error with a status, and the key read from the
 * environment at call time rather than at import — a module-scope read makes the
 * whole route fail to build when the variable is absent.
 */

import { maskUsername } from "@/lib/leaderboard-mask"

/** What the rest of the app sees. No provider field names, no external ids. */
export type LeaderboardStanding = {
  rank: number
  username: string
  avatar: string | null
  score: number
}

/**
 * The same row with the provider's account id still attached.
 *
 * Only the sync job wants this. A masked name is not something you can pay, so
 * the stored row keeps the opaque id in leaderboard_entries.user_ref — which is
 * what migration 042 added that column for. It never goes to a browser.
 */
export type StandingWithRef = LeaderboardStanding & { ref: string | null }

export class LeaderboardApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "LeaderboardApiError"
    this.status = status
  }
}

/**
 * The provider caches a result for 30 minutes against the exact
 * startDate-endDate-limit it was asked for. Polling faster returns the same
 * bytes, so this cache matches that window: past it the upstream is worth
 * asking again, inside it there is nothing new to get.
 */
export const CACHE_TTL_MS = 30 * 60_000

/** The provider refuses anything larger. */
export const MAX_LIMIT = 50

/** The provider refuses a window wider than this. */
export const MAX_RANGE_DAYS = 31

const REQUEST_TIMEOUT_MS = 10_000

// Holds the rows with their ids; the public view strips them on the way out, so
// one fetch serves both callers.
const cache = new Map<string, { expires: number; standings: StandingWithRef[] }>()

/** Visible for tests, and for the admin's "refresh now". */
export function clearStandingsCache(): void {
  cache.clear()
}

export type StandingsQuery = {
  /** Absolute instant, inclusive. */
  startDate: string
  /** Absolute instant, inclusive. */
  endDate: string
  limit?: number
}

/**
 * The score sits beside `user` under the provider's own name. On the feed we
 * have that is `totalWagered` — camelCase, because it comes from the API and
 * not from our own column, which is total_wagered.
 *
 * The other spellings are there so a rename upstream does not produce a board
 * of zeroes that looks like a quiet week.
 */
const SCORE_KEYS = ["totalWagered", "total_wagered", "wagered", "wagerAmount", "amount", "score", "points"]

/**
 * Fields that are numbers but are not the score.
 *
 * The fallback below takes "the numeric field that is not `user`", and that is
 * only safe while nothing else numeric rides along. A feed that starts sending
 * its own `rank` or `position` per row would otherwise rank every player by
 * their place — which sorts into a plausible-looking and completely wrong board.
 */
const NON_SCORE_KEYS = new Set([
  "rank",
  "position",
  "place",
  "index",
  "id",
  "userId",
  "user_id",
  "count",
  "timestamp",
  "updatedAt",
  "createdAt",
])

export function readScore(entry: Record<string, unknown>): number | null {
  for (const key of SCORE_KEYS) {
    const value = entry[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    // Some feeds send amounts as strings.
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  }

  for (const [key, value] of Object.entries(entry)) {
    if (key === "user" || NON_SCORE_KEYS.has(key)) continue
    if (typeof value === "number" && Number.isFinite(value)) {
      // Worth knowing about: the feed has been renamed and this is a guess.
      console.warn(`[leaderboard] no known score field; falling back to "${key}"`)
      return value
    }
  }
  return null
}

/** Only http(s) URLs are rendered; anything else becomes the initial fallback. */
export function readAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

/**
 * The payload as standings.
 *
 * Exported separately from the fetch so the mapping can be tested without a
 * network, and so a malformed row is dropped rather than rendering as a blank
 * row with a zero. The feed states its rows arrive sorted; they are sorted again
 * here anyway, because rank is derived from position and trusting someone else's
 * ordering for that is a silent wrong answer if it ever stops holding.
 */
export function mapStandingsWithRef(payload: unknown, limit = MAX_LIMIT): StandingWithRef[] {
  if (!payload || typeof payload !== "object") {
    throw new LeaderboardApiError("The standings could not be read.", 502)
  }

  const body = payload as { success?: unknown; data?: unknown }

  // An explicit failure flag is an error even when the transport said 200.
  if (body.success === false) {
    throw new LeaderboardApiError("The standings are not available right now.", 502)
  }

  if (!Array.isArray(body.data)) {
    throw new LeaderboardApiError("The standings could not be read.", 502)
  }

  const rows: Omit<StandingWithRef, "rank">[] = []

  for (const raw of body.data) {
    if (!raw || typeof raw !== "object") continue
    const entry = raw as Record<string, unknown>
    const user = (entry.user ?? {}) as Record<string, unknown>

    const username = typeof user.username === "string" ? user.username.trim() : ""
    if (!username) continue

    const score = readScore(entry)
    if (score === null) continue

    rows.push({
      // Masked here, at the boundary. Doing it in the component would mean the
      // full name still travelled to the browser in the JSON, which is the one
      // thing masking is for. The real name is not kept anywhere: `ref` is what
      // identifies the player from here on.
      username: maskUsername(username),
      avatar: readAvatar(user.avatar),
      score,
      ref: typeof user.id === "string" && user.id.trim() ? user.id.trim() : null,
    })
  }

  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, Math.min(limit, MAX_LIMIT)))
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

/** The same, without the provider's account id. Everything public uses this. */
export function mapStandings(payload: unknown, limit = MAX_LIMIT): LeaderboardStanding[] {
  return mapStandingsWithRef(payload, limit).map(({ ref: _ref, ...row }) => row)
}

/** Both ends as the provider wants them: ISO 8601, UTC, whole seconds. */
export function toApiDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new LeaderboardApiError("That board has no usable date range.", 400)
  }
  // Milliseconds are dropped so two calls for the same window produce the same
  // string, and therefore the same cache key here and upstream.
  return date.toISOString().replace(/\.\d{3}Z$/, "Z")
}

export function rangeDays(startDate: string, endDate: string): number {
  return (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
}

/**
 * Standings for one window.
 *
 * Throws LeaderboardApiError with a message meant for the page. The upstream
 * status and body are logged, never returned: they name the provider and
 * sometimes echo the key.
 */
export async function fetchStandingsWithRef(query: StandingsQuery): Promise<StandingWithRef[]> {
  const baseUrl = process.env.LEADERBOARD_API_URL
  const apiKey = process.env.LEADERBOARD_API_KEY

  if (!baseUrl || !apiKey) {
    // Fails closed: without a key this would otherwise call an unauthenticated
    // endpoint and render whatever came back.
    throw new LeaderboardApiError("Live standings are not configured.", 503)
  }

  const startDate = toApiDate(query.startDate)
  const endDate = toApiDate(query.endDate)
  const limit = Math.max(1, Math.min(Math.trunc(query.limit ?? MAX_LIMIT) || MAX_LIMIT, MAX_LIMIT))

  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    throw new LeaderboardApiError("That board ends before it starts.", 400)
  }
  if (rangeDays(startDate, endDate) > MAX_RANGE_DAYS) {
    throw new LeaderboardApiError(
      `Live standings cover at most ${MAX_RANGE_DAYS} days; this board runs longer.`,
      400,
    )
  }

  // The same three values the upstream keys its own cache on.
  const cacheKey = `${startDate}|${endDate}|${limit}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.standings

  const url = new URL(baseUrl)
  url.searchParams.set("startDate", startDate)
  url.searchParams.set("endDate", endDate)
  url.searchParams.set("limit", String(limit))

  let response: Response | undefined

  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { "x-api-key": apiKey, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (problem) {
      // A timeout and a DNS failure both land here.
      console.error("[leaderboard] upstream request failed:", problem)
      throw new LeaderboardApiError("The standings could not be reached.", 504)
    }

    if (response.status !== 429 || attempt === 1) break

    // 2 requests per minute upstream, so a retry has to wait out the window
    // rather than fire straight back.
    const retryAfter = Number(response.headers.get("retry-after"))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : 5_000
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  if (!response || !response.ok) {
    let detail = ""
    try {
      detail = (await response?.text()) ?? ""
    } catch {
      // The body is a nicety for the log; losing it changes nothing.
    }
    console.error(`[leaderboard] upstream responded ${response?.status ?? "none"}:`, detail.slice(0, 500))

    if (response?.status === 429) {
      throw new LeaderboardApiError("The standings are being refreshed. Try again shortly.", 429)
    }
    throw new LeaderboardApiError("The standings are not available right now.", 502)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new LeaderboardApiError("The standings could not be read.", 502)
  }

  const standings = mapStandingsWithRef(payload, limit)
  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, standings })
  return standings
}

/**
 * Standings without the provider's account ids.
 *
 * Everything that answers a browser calls this one; only the sync job, which
 * has to write user_ref, calls the variant above.
 */
export async function fetchStandings(query: StandingsQuery): Promise<LeaderboardStanding[]> {
  const standings = await fetchStandingsWithRef(query)
  return standings.map(({ ref: _ref, ...row }) => row)
}
