const BASE_URL = "https://bonushunt.gg"

type FetchOptions = {
  method?: string
  body?: unknown
  // cache TTL in ms for GET requests (default 10s to stay below 100 requests/minute)
  cacheTtl?: number
}

// Simple in-memory cache to keep polling below bonushunt.gg's 100 requests/minute limit.
// Cache is per server instance; failed authentication is never retried.
const cache = new Map<string, { expires: number; data: unknown }>()

export type ExternalBonus = {
  id: string
  slotName: string
  provider: string | null
  betSize: number
  payout: number | null
  multiplier: number | null
}

export type ExternalHuntSummary = {
  id: string
  title: string
  casino: string
  startCost: number
  status?: "opening" | "completed" | string
  isOpening: boolean
  stats?: {
    bonusCount?: number
    openedBonuses?: number
    unopenedBonuses?: number
    totalWinnings?: number
    profitLoss?: number
    profitLossPercentage?: number
  }
  bonuses?: ExternalBonus[]
}

export type ExternalHuntDetail = ExternalHuntSummary & {
  currentOpeningSlot?: string | null
  createdAt?: string
  bonuses: ExternalBonus[]
}

// Local hunt shape used across the app (matches the bonus_hunts table rows)
export type MappedHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
  is_super: boolean
}

class BonushuntApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "BonushuntApiError"
    this.status = status
  }
}

export async function bonushuntFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const apiKey = process.env.API_KEY_Bonushuntgg
  if (!apiKey) {
    throw new BonushuntApiError("Missing API_KEY_Bonushuntgg environment variable", 500)
  }

  const method = options.method || "GET"
  const cacheKey = `${method}:${path}`

  if (method === "GET") {
    const cached = cache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      return cached.data as T
    }
  }

  let res: Response | undefined

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    })

    if (res.status !== 429 || attempt === 2) break

    const retryAfter = Number(res.headers.get("retry-after"))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 30_000)
      : 2 ** attempt * 1000
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }

  if (!res || !res.ok) {
    let detail = ""
    try {
      detail = (await res?.text()) ?? ""
    } catch {
      // ignore
    }
    throw new BonushuntApiError(
      res?.status === 429
        ? "Rate limit exceeded (100 requests/minute). Please try again shortly."
        : `bonushunt.gg request failed (${res?.status ?? 502}): ${detail}`,
      res?.status ?? 502,
    )
  }

  const data = (await res.json()) as T

  if (method === "GET") {
    const ttl = options.cacheTtl ?? 10_000
    cache.set(cacheKey, { expires: Date.now() + ttl, data })
  }

  return data
}

export async function getExternalHunts(params: {
  limit?: number
  offset?: number
  status?: "opening" | "completed"
} = {}) {
  const search = new URLSearchParams()
  if (params.limit) search.set("limit", String(params.limit))
  if (params.offset) search.set("offset", String(params.offset))
  if (params.status) search.set("status", params.status)
  const qs = search.toString()
  return bonushuntFetch<{
    hunts: ExternalHuntSummary[]
    pagination: { limit: number; offset: number; total: number; hasMore: boolean }
  }>(`/api/public/hunts${qs ? `?${qs}` : ""}`)
}

export async function getExternalHunt(id: string) {
  return bonushuntFetch<ExternalHuntDetail>(`/api/public/hunts/${id}`)
}

export async function getExternalStats() {
  return bonushuntFetch<Record<string, unknown>>(`/api/public/stats`)
}

export async function getGuessTheBalanceStatus(id: string) {
  return bonushuntFetch<Record<string, unknown>>(`/api/public/hunts/${id}/guess-the-balance`)
}

export async function submitSlotRequest(body: {
  huntId: string
  username: string
  slotName: string
  provider?: string
}) {
  return bonushuntFetch<Record<string, unknown>>(`/api/public/slot-request`, {
    method: "POST",
    body,
  })
}

export async function submitGuessTheBalance(body: {
  huntId: string
  username?: string
  guessAmount?: number
  guesses?: Array<{ username: string; guessAmount: number }>
}) {
  return bonushuntFetch<Record<string, unknown>>(`/api/public/guess-the-balance`, {
    method: "POST",
    body,
  })
}

function mapBonusToHunt(bonus: ExternalBonus, hunt: ExternalHuntSummary): MappedHunt {
  return {
    id: bonus.id,
    game_name: bonus.slotName,
    provider: bonus.provider ?? null,
    bet_size: Number(bonus.betSize) || 0,
    result: bonus.payout === null || bonus.payout === undefined ? null : Number(bonus.payout),
    starting_balance: Number(hunt.startCost) || 0,
    opening_balance: 0,
    created_at: (hunt as ExternalHuntDetail).createdAt || new Date().toISOString(),
    is_super: false,
  }
}

// Returns the latest opening hunt (fallback: most recent) mapped to the local hunt shape.
export async function getCurrentExternalHuntMapped(): Promise<{
  hunt: ExternalHuntDetail | null
  rows: MappedHunt[]
}> {
  // Prefer an opening hunt
  let list = await getExternalHunts({ status: "opening", limit: 1 })
  if (!list.hunts || list.hunts.length === 0) {
    // Fallback to the most recent hunt of any status
    list = await getExternalHunts({ limit: 1 })
  }

  const summary = list.hunts?.[0]
  if (!summary) {
    return { hunt: null, rows: [] }
  }

  // The detail endpoint is authoritative for status and opening state.
  const detail = await getExternalHunt(summary.id)
  const bonuses = detail.bonuses || summary.bonuses || []
  const rows = bonuses.map((b) => mapBonusToHunt(b, detail))

  return { hunt: detail, rows }
}

export { BonushuntApiError }
