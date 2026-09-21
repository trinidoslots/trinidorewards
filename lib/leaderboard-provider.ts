/**
 * What one wager feed looks like, as data rather than as code.
 *
 * The first provider was written into lib/leaderboard-api: its field names, its
 * query parameters, its 50-row cap. A second one would have meant editing that
 * file and deploying, which is a strange thing to need in order to add a
 * business partner.
 *
 * Everything that differs between these APIs is here instead, so a new provider
 * is rows in a table and a form in the admin panel. The defaults are the feed
 * already in use, so a board with no provider configured behaves exactly as it
 * did.
 *
 * What this deliberately does NOT try to be is a general-purpose HTTP client.
 * It handles the shape these feeds actually have — a list of player objects
 * somewhere in the response, each with a name, a number and maybe a picture.
 * A provider that paginates, signs requests, or nests its rows two lists deep
 * needs code, and should get code.
 *
 * Only one provider's response has ever been seen. The axes below are the ones
 * that differ across affiliate APIs in general; whether they are the right axes
 * for the *second* provider is an educated guess until there is a second
 * provider.
 */

/** How a provider wants the window expressed. */
export type DateFormat = "iso" | "iso_ms" | "date" | "unix_s" | "unix_ms"

export const DATE_FORMATS: { id: DateFormat; label: string; example: string }[] = [
  { id: "iso", label: "ISO 8601", example: "2026-09-14T00:00:00Z" },
  { id: "iso_ms", label: "ISO 8601 with milliseconds", example: "2026-09-14T00:00:00.000Z" },
  { id: "date", label: "Date only", example: "2026-09-14" },
  { id: "unix_s", label: "Unix seconds", example: "1789344000" },
  { id: "unix_ms", label: "Unix milliseconds", example: "1789344000000" },
]

export function isDateFormat(value: unknown): value is DateFormat {
  return DATE_FORMATS.some((entry) => entry.id === value)
}

export type ProviderConfig = {
  /** The row this came from, or null when it came from the environment. */
  id: string | null
  name: string

  // --- the request ----------------------------------------------------------
  baseUrl: string
  apiKey: string
  /** Header carrying the key. "x-api-key" here, "Authorization" elsewhere. */
  authHeader: string
  /** Prefix inside that header, e.g. "Bearer". Null sends the key by itself. */
  authScheme: string | null
  startParam: string
  endParam: string
  /** Null means the provider takes no limit and everything it sends is used. */
  limitParam: string | null
  dateFormat: DateFormat
  maxLimit: number
  maxRangeDays: number
  /** How long a result may be reused. Matching the provider's own cache. */
  cacheMinutes: number

  // --- the response ---------------------------------------------------------
  /** Dot path to the array of players. Empty string means the response IS it. */
  rowsPath: string
  /** Dot path within one row. "user.username", or just "username". */
  usernamePath: string
  scorePath: string
  /**
   * What to divide the feed's number by to get currency.
   *
   * These feeds do not all count in dollars. EarnLab reports coins at a
   * thousand to the dollar, so its 160524 is $160.52 — printed raw it read as
   * $160,524.00 and made every board look a thousand times richer than it is.
   * 1 means the feed already reports currency.
   */
  scoreDivisor: number
  avatarPath: string | null
  /** The provider's own account id, kept for payouts. */
  refPath: string | null
  /** A flag that is false on a failure served with HTTP 200. */
  successPath: string | null
}

/**
 * The feed already in use.
 *
 * These are also the form's initial values, because a second affiliate
 * leaderboard is more likely to resemble this one than to resemble nothing.
 */
export const DEFAULT_CONFIG: Omit<ProviderConfig, "id" | "name" | "baseUrl" | "apiKey"> = {
  authHeader: "x-api-key",
  authScheme: null,
  startParam: "startDate",
  endParam: "endDate",
  limitParam: "limit",
  dateFormat: "iso",
  maxLimit: 50,
  maxRangeDays: 31,
  cacheMinutes: 30,
  rowsPath: "data",
  usernamePath: "user.username",
  scorePath: "totalWagered",
  // EarnLab counts in coins, a thousand to the dollar. This is also the form's
  // starting value, so a feed that reports plain currency must be set to 1 —
  // the panel's test button shows the converted figure, which is where that
  // gets noticed.
  scoreDivisor: 1000,
  avatarPath: "user.avatar",
  refPath: "user.id",
  successPath: "success",
}

/**
 * The feed's number as currency.
 *
 * Rounded to the cent because leaderboard_entries.total_wagered is
 * DECIMAL(10,2): without it the live fetch would show three decimals and the
 * stored row two, and the same board would disagree with itself depending on
 * which path it was read through.
 */
export function convertScore(raw: number, divisor: number): number {
  const by = Number.isFinite(divisor) && divisor > 0 ? divisor : 1
  return Math.round((raw / by) * 100) / 100
}

/**
 * A key as the admin panel shows it back.
 *
 * Enough to tell which key is in the field — they all start sk_live_ or
 * similar — without the panel being somewhere the key can be read off a
 * screen. The stored value never leaves the server in full.
 */
export function maskKey(key: string | null | undefined): string {
  const trimmed = (key ?? "").trim()
  if (!trimmed) return ""
  if (trimmed.length <= 8) return "••••••••"
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}

/**
 * Follows "user.username" into an object.
 *
 * An empty path returns the object itself, which is how a provider that
 * responds with a bare array rather than {data: [...]} is described.
 */
export function readPath(source: unknown, path: string): unknown {
  if (!path) return source
  let current: unknown = source
  for (const segment of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** A number from whatever the feed put there — some send amounts as strings. */
export function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** The window as this provider wants to read it. */
export function formatDate(value: string | Date, format: DateFormat): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error("That board has no usable date range.")

  switch (format) {
    case "iso_ms":
      return date.toISOString()
    case "date":
      return date.toISOString().slice(0, 10)
    case "unix_s":
      return String(Math.floor(date.getTime() / 1000))
    case "unix_ms":
      return String(date.getTime())
    case "iso":
    default:
      // Whole seconds, so two calls for one window produce one string — and so
      // the provider's own cache, which keys on the literal parameters, is hit
      // rather than missed every time.
      return date.toISOString().replace(/\.\d{3}Z$/, "Z")
  }
}

/** The header this provider authenticates with. */
export function authHeaders(config: ProviderConfig): Record<string, string> {
  const value = config.authScheme ? `${config.authScheme} ${config.apiKey}` : config.apiKey
  return { [config.authHeader]: value, accept: "application/json" }
}

/** The full request URL for one window. */
export function buildUrl(config: ProviderConfig, startDate: string, endDate: string, limit: number): URL {
  const url = new URL(config.baseUrl)
  url.searchParams.set(config.startParam, formatDate(startDate, config.dateFormat))
  url.searchParams.set(config.endParam, formatDate(endDate, config.dateFormat))
  if (config.limitParam) url.searchParams.set(config.limitParam, String(limit))
  return url
}

/** A row as read through one provider's paths, before ranking. */
export type RawStanding = {
  username: string
  avatar: unknown
  score: number
  ref: string | null
}

export type ReadResult =
  | { ok: true; rows: RawStanding[] }
  | { ok: false; reason: "declared-failure" | "not-an-object" | "rows-not-a-list" }

/**
 * The payload as rows, through this provider's paths.
 *
 * Ranking, masking and the avatar check happen a layer up, because those are
 * the same whoever the provider is. This only answers "where are the players
 * and what are they called here".
 */
export function readRows(payload: unknown, config: ProviderConfig): ReadResult {
  if (payload === null || payload === undefined) return { ok: false, reason: "not-an-object" }

  // A bare array is a valid response — rowsPath "" describes exactly that — but
  // a string is a 502 page, not a payload.
  if (typeof payload !== "object") return { ok: false, reason: "not-an-object" }

  if (config.successPath) {
    const flag = readPath(payload, config.successPath)
    // Only an explicit false counts. A provider that omits the field entirely
    // has not failed, it just does not have one.
    if (flag === false) return { ok: false, reason: "declared-failure" }
  }

  const list = readPath(payload, config.rowsPath)
  if (!Array.isArray(list)) return { ok: false, reason: "rows-not-a-list" }

  const rows: RawStanding[] = []

  for (const entry of list) {
    if (entry === null || entry === undefined || typeof entry !== "object") continue

    const name = readPath(entry, config.usernamePath)
    const username = typeof name === "string" ? name.trim() : ""
    if (!username) continue

    const score = readNumber(readPath(entry, config.scorePath))
    if (score === null) continue

    const rawRef = config.refPath ? readPath(entry, config.refPath) : null
    // Numeric ids are common and must survive as text, since user_ref is TEXT.
    const ref =
      typeof rawRef === "string" && rawRef.trim()
        ? rawRef.trim()
        : typeof rawRef === "number" && Number.isFinite(rawRef)
          ? String(rawRef)
          : null

    rows.push({
      username,
      avatar: config.avatarPath ? readPath(entry, config.avatarPath) : null,
      score,
      ref,
    })
  }

  return { ok: true, rows }
}

/** One row of the providers table, as the database spells it. */
export type ProviderRow = {
  id: string
  name: string
  base_url: string
  api_key: string
  auth_header: string | null
  auth_scheme: string | null
  start_param: string | null
  end_param: string | null
  limit_param: string | null
  date_format: string | null
  max_limit: number | null
  max_range_days: number | null
  cache_minutes: number | null
  rows_path: string | null
  username_path: string | null
  score_path: string | null
  score_divisor: number | string | null
  avatar_path: string | null
  ref_path: string | null
  success_path: string | null
}

/**
 * A stored row as a config, with anything missing filled from the defaults.
 *
 * Written to tolerate nulls throughout: a column added later is null on every
 * existing row, and a provider that stops working because a column was added
 * is a bad trade for the convenience of a NOT NULL.
 */
export function configFromRow(row: ProviderRow): ProviderConfig {
  const text = (value: string | null | undefined, fallback: string): string => {
    const trimmed = (value ?? "").trim()
    return trimmed || fallback
  }
  const count = (value: number | null | undefined, fallback: number): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
  }
  // Distinguishes "not set" from "deliberately empty": rowsPath is legitimately
  // "" for a provider that answers with a bare array, so an empty string there
  // must not fall back to "data".
  const optional = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed || null
  }

  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    authHeader: text(row.auth_header, DEFAULT_CONFIG.authHeader),
    authScheme: optional(row.auth_scheme),
    startParam: text(row.start_param, DEFAULT_CONFIG.startParam),
    endParam: text(row.end_param, DEFAULT_CONFIG.endParam),
    limitParam: optional(row.limit_param),
    dateFormat: isDateFormat(row.date_format) ? row.date_format : DEFAULT_CONFIG.dateFormat,
    maxLimit: count(row.max_limit, DEFAULT_CONFIG.maxLimit),
    maxRangeDays: count(row.max_range_days, DEFAULT_CONFIG.maxRangeDays),
    cacheMinutes: count(row.cache_minutes, DEFAULT_CONFIG.cacheMinutes),
    rowsPath: row.rows_path === null || row.rows_path === undefined ? DEFAULT_CONFIG.rowsPath : row.rows_path.trim(),
    usernamePath: text(row.username_path, DEFAULT_CONFIG.usernamePath),
    scorePath: text(row.score_path, DEFAULT_CONFIG.scorePath),
    // Postgres hands NUMERIC back as a string. Falls back to 1 rather than to
    // the default of 1000: a provider whose divisor did not survive the round
    // trip should read a thousand times too high, which is obvious, rather than
    // a thousand times too low, which looks like a quiet week.
    scoreDivisor: (() => {
      const parsed = Number(row.score_divisor)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
    })(),
    avatarPath: optional(row.avatar_path),
    refPath: optional(row.ref_path),
    successPath: optional(row.success_path),
  }
}

/**
 * The provider described by the environment.
 *
 * What every board used before there was a providers table, and what a board
 * with none assigned still uses. Returns null when the variables are unset, so
 * the caller can fail closed rather than call an unauthenticated endpoint.
 */
export function configFromEnv(): ProviderConfig | null {
  const baseUrl = process.env.LEADERBOARD_API_URL
  const apiKey = process.env.LEADERBOARD_API_KEY
  if (!baseUrl || !apiKey) return null

  return { ...DEFAULT_CONFIG, id: null, name: "Default", baseUrl, apiKey }
}
