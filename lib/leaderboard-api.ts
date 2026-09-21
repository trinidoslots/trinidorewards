/**
 * Talking to a wager feed, whichever one it is.
 *
 * This file knows how to make an HTTP request and how to turn a list of players
 * into standings. What it does not know is any provider's field names, host,
 * header or limits — those arrive as a ProviderConfig from
 * lib/leaderboard-provider, which comes from a row in leaderboard_providers or,
 * for a board with none assigned, from the environment.
 *
 * Nothing outside this file sees the provider's vocabulary. Callers get
 * `LeaderboardStanding[]` and, on a failure, a `LeaderboardApiError` carrying a
 * message that is safe to put in front of a visitor.
 *
 * Follows lib/bonushunt-api.ts, which is how this codebase already talks to an
 * external API: TTL cache in module memory, one retry on 429 honouring
 * retry-after, and a typed error with a status.
 */

import { maskUsername } from "@/lib/leaderboard-mask"
import {
  authHeaders,
  buildUrl,
  convertScore,
  formatDate,
  readRows,
  type ProviderConfig,
} from "@/lib/leaderboard-provider"

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

const REQUEST_TIMEOUT_MS = 10_000

/** leaderboard_entries.avatar_url is VARCHAR(500). */
const MAX_AVATAR_LENGTH = 500

// Keyed by provider as well as window: two providers asked for the same dates
// are two different answers.
const cache = new Map<string, { expires: number; standings: StandingWithRef[] }>()

/** Visible for tests, and for an admin's "refresh now". */
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
 * Only http(s) URLs are rendered; anything else becomes the initial fallback.
 *
 * Anything over the column's width is dropped rather than truncated: a cut-off
 * URL is a URL that 404s, and storing one would fail the whole board's write
 * over a single player's picture. Dicebear generates these with the avatar's
 * entire configuration in the query string, so they do get long.
 */
export function readAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  if (trimmed.length > MAX_AVATAR_LENGTH) return null
  return trimmed
}

export function rangeDays(startDate: string, endDate: string): number {
  return (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
}

/**
 * The payload as standings, through one provider's paths.
 *
 * Exported separately from the fetch so the mapping can be tested without a
 * network. The feeds state their rows arrive sorted; they are sorted again here
 * anyway, because rank is derived from position and trusting someone else's
 * ordering for that is a wrong answer that looks right.
 */
export function mapStandingsWithRef(
  payload: unknown,
  config: ProviderConfig,
  limit: number,
): StandingWithRef[] {
  const result = readRows(payload, config)

  if (!result.ok) {
    // The reason is for the log; the visitor gets the same sentence either way.
    if (result.reason === "declared-failure") {
      throw new LeaderboardApiError("The standings are not available right now.", 502)
    }
    throw new LeaderboardApiError("The standings could not be read.", 502)
  }

  return (
    result.rows
      .slice()
      // Sorted on the feed's own number, before the divisor and the rounding to
      // cents. Two players a few coins apart round to the same cent, and
      // ordering on the rounded figure would put them in whichever order the
      // sort happened to leave them.
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit))
      .map((row, index) => ({
        rank: index + 1,
        // Masked here, at the boundary. Doing it in the component would mean
        // the full name still travelled to the browser in the JSON, which is
        // the one thing masking is for. The real name is kept nowhere: `ref` is
        // what identifies the player from here on.
        username: maskUsername(row.username),
        avatar: readAvatar(row.avatar),
        score: convertScore(row.score, config.scoreDivisor),
        ref: row.ref,
      }))
  )
}

/** The same, without the provider's account id. Everything public uses this. */
export function mapStandings(
  payload: unknown,
  config: ProviderConfig,
  limit: number,
): LeaderboardStanding[] {
  return mapStandingsWithRef(payload, config, limit).map(({ ref: _ref, ...row }) => row)
}

/**
 * Standings for one window from one provider.
 *
 * Throws LeaderboardApiError with a message meant for the page. The upstream
 * status and body are logged, never returned: they name the provider and
 * sometimes echo the key.
 */
export async function fetchStandingsWithRef(
  config: ProviderConfig,
  query: StandingsQuery,
): Promise<StandingWithRef[]> {
  const limit = Math.max(
    1,
    Math.min(Math.trunc(query.limit ?? config.maxLimit) || config.maxLimit, config.maxLimit),
  )

  let startDate: string
  let endDate: string
  try {
    startDate = formatDate(query.startDate, config.dateFormat)
    endDate = formatDate(query.endDate, config.dateFormat)
  } catch {
    throw new LeaderboardApiError("That board has no usable date range.", 400)
  }

  if (new Date(query.endDate).getTime() < new Date(query.startDate).getTime()) {
    throw new LeaderboardApiError("That board ends before it starts.", 400)
  }
  if (rangeDays(query.startDate, query.endDate) > config.maxRangeDays) {
    throw new LeaderboardApiError(
      `Live standings cover at most ${config.maxRangeDays} days; this board runs longer.`,
      400,
    )
  }

  // The same values the upstream keys its own cache on, plus which upstream.
  const cacheKey = `${config.id ?? "env"}|${startDate}|${endDate}|${limit}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.standings

  let url: URL
  try {
    url = buildUrl(config, query.startDate, query.endDate, limit)
  } catch {
    // An unparseable base URL is a typo in the admin panel, not an outage.
    throw new LeaderboardApiError("That provider's address is not a valid URL.", 500)
  }

  let response: Response | undefined

  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "GET",
        headers: authHeaders(config),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (problem) {
      // A timeout and a DNS failure both land here.
      console.error(`[leaderboard] ${config.name}: request failed:`, problem)
      throw new LeaderboardApiError("The standings could not be reached.", 504)
    }

    if (response.status !== 429 || attempt === 1) break

    // These feeds allow very few requests a minute, so a retry has to wait out
    // the window rather than fire straight back.
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
    console.error(
      `[leaderboard] ${config.name}: upstream responded ${response?.status ?? "none"}:`,
      detail.slice(0, 500),
    )

    if (response?.status === 401 || response?.status === 403) {
      throw new LeaderboardApiError("That provider rejected the API key.", 502)
    }
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

  const standings = mapStandingsWithRef(payload, config, limit)
  cache.set(cacheKey, { expires: Date.now() + config.cacheMinutes * 60_000, standings })
  return standings
}

/**
 * Standings without the provider's account ids.
 *
 * Everything that answers a browser calls this one; only the sync job, which
 * has to write user_ref, calls the variant above.
 */
export async function fetchStandings(
  config: ProviderConfig,
  query: StandingsQuery,
): Promise<LeaderboardStanding[]> {
  const standings = await fetchStandingsWithRef(config, query)
  return standings.map(({ ref: _ref, ...row }) => row)
}
