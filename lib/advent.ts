/**
 * The advent calendar: types, door states and the calendar generator, shared
 * by the public page and the admin panel. Tables in scripts/031 and 032.
 *
 * Kept free of React and Supabase so the generator can be tried on its own.
 */

export type AdventReward = {
  id: string
  day_number: number
  title: string
  description: string
  icon: string
  reward_type: string
  reward_value: string | null
  is_active: boolean
  /** Weight in percent; a day's active rewards add up to 100. The table refuses 0. */
  probability: number
  display_order?: number
}

export type AdventClaim = {
  day_number: number
  claimed_at: string
  reward_title?: string | null
  reward_icon?: string | null
  reward_value?: string | null
}

export const DOORS = 24

/* -------------------------------------------------------------------------- */
/*                                 Door states                                */
/* -------------------------------------------------------------------------- */

export type DoorState = "locked" | "today" | "claimed" | "missed"

/**
 * Doors run on GMT (UTC) for everyone: door 7 opens at 00:00 GMT on
 * 7 December wherever you are, and the claim route checks the same date. A
 * calendar in each viewer's own timezone opened the same door at different
 * moments for different people.
 */
export function utcDay(now = new Date()): { month: number; day: number; year: number } {
  return { month: now.getUTCMonth(), day: now.getUTCDate(), year: now.getUTCFullYear() }
}

export function doorState(day: number, claimed: boolean, now = new Date()): DoorState {
  if (claimed) return "claimed"
  const { month, day: today } = utcDay(now)
  if (month !== 11) return "locked"
  if (day === today) return "today"
  return day < today ? "missed" : "locked"
}

/** The next moment a door opens, in GMT: 1 December before the season, the next midnight during it, null after the 24th. */
export function nextOpening(now = new Date()): Date | null {
  const { month, day, year } = utcDay(now)
  if (month < 11) return new Date(Date.UTC(year, 11, 1))
  if (month === 11 && day < DOORS) return new Date(Date.UTC(year, 11, day + 1))
  return null
}

/* -------------------------------------------------------------------------- */
/*                                  Generator                                 */
/* -------------------------------------------------------------------------- */

export type Tier = "common" | "rare" | "epic"

/** One kind of reward the generator can put behind a door. */
export type RewardTemplate = {
  icon: string
  title: string
  value: string
  tier: Tier
}

/** A reward that has not been saved yet. */
export type DraftReward = Omit<AdventReward, "id" | "is_active"> & { id?: string; is_active?: boolean }

/**
 * A starting pool. Every one of these is fulfilled by hand, as all advent
 * rewards are — opening a door records the win, it does not pay anything out —
 * so the pool is meant to be edited to what the stream can actually give.
 */
export const DEFAULT_POOL: RewardTemplate[] = [
  { icon: "🪙", title: "100 points", value: "100 points", tier: "common" },
  { icon: "🪙", title: "250 points", value: "250 points", tier: "common" },
  { icon: "🎟️", title: "Raffle entry", value: "1 entry", tier: "common" },
  { icon: "🎰", title: "10 free spins", value: "10 spins", tier: "common" },
  { icon: "💰", title: "500 points", value: "500 points", tier: "rare" },
  { icon: "💵", title: "$5 tip", value: "$5", tier: "rare" },
  { icon: "🎰", title: "50 free spins", value: "50 spins", tier: "rare" },
  { icon: "💎", title: "1,000 points", value: "1,000 points", tier: "epic" },
  { icon: "💵", title: "$25 tip", value: "$25", tier: "epic" },
  { icon: "👑", title: "Mystery prize", value: "Mystery prize", tier: "epic" },
]

export const TIERS: { id: Tier; label: string; /** How often it is picked for a door. */ pick: number; /** Its share of the odds once behind one. */ odds: number }[] = [
  { id: "common", label: "Common", pick: 6, odds: 60 },
  { id: "rare", label: "Rare", pick: 3, odds: 30 },
  { id: "epic", label: "Epic", pick: 1, odds: 10 },
]

const tierOf = (id: Tier) => TIERS.find((tier) => tier.id === id) ?? TIERS[0]

export type GenerateOptions = {
  /** How many rewards share each door, 1 to 4. */
  perDoor: number
  /** Doors that draw only rare and epic rewards, with at least one epic. */
  bigDays: number[]
  /** "weighted": common rewards are likelier than rare ones. "even": every reward on a door has the same chance. */
  odds: "weighted" | "even"
}

export const DEFAULT_OPTIONS: GenerateOptions = { perDoor: 3, bigDays: [6, 12, 18, 24], odds: "weighted" }

type Random = () => number

/** One weighted draw without putting back. */
function drawOne<T>(items: T[], weight: (item: T) => number, random: Random): T | undefined {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0)
  if (total <= 0) return items[Math.floor(random() * items.length)]
  let roll = random() * total
  for (const item of items) {
    roll -= Math.max(0, weight(item))
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

/**
 * Percentages that add up to exactly 100 with two decimals.
 *
 * Rounding each share on its own can leave 99.99 or 100.01, which the admin's
 * own check then refuses; the remainder goes to the largest share.
 */
export function toPercentages(weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  const shares = weights.map((weight) => Math.max(0.01, Math.round((weight / total) * 10000) / 100))
  const drift = Math.round((100 - shares.reduce((sum, share) => sum + share, 0)) * 100) / 100
  const largest = shares.indexOf(Math.max(...shares))
  shares[largest] = Math.round((shares[largest] + drift) * 100) / 100
  return shares
}

/** The rewards for one door. `avoid` lowers the odds of repeating the day before. */
export function generateDay(
  day: number,
  pool: RewardTemplate[],
  options: GenerateOptions,
  random: Random = Math.random,
  avoid: string[] = [],
): DraftReward[] {
  const usable = pool.filter((template) => template.title.trim())
  if (usable.length === 0) return []

  const big = options.bigDays.includes(day)
  let candidates = big ? usable.filter((template) => template.tier !== "common") : usable
  if (candidates.length === 0) candidates = usable

  const count = Math.max(1, Math.min(4, Math.round(options.perDoor), candidates.length))
  const chosen: RewardTemplate[] = []

  // A big door is promised an epic, so that one is drawn first.
  if (big) {
    const epic = drawOne(candidates.filter((template) => template.tier === "epic"), () => 1, random)
    if (epic) chosen.push(epic)
  }

  while (chosen.length < count) {
    const left = candidates.filter((template) => !chosen.includes(template))
    const next = drawOne(left, (template) => tierOf(template.tier).pick * (avoid.includes(template.title) ? 0.25 : 1), random)
    if (!next) break
    chosen.push(next)
  }

  // Likeliest first, so the door's list reads from what you will probably get.
  chosen.sort((a, b) => tierOf(b.tier).odds - tierOf(a.tier).odds)
  const odds = toPercentages(chosen.map((template) => (options.odds === "even" ? 1 : tierOf(template.tier).odds)))

  return chosen.map((template, index) => ({
    day_number: day,
    title: template.title.trim(),
    description: `${template.title.trim()} behind door ${day}.`,
    icon: template.icon || "🎁",
    reward_type: template.tier,
    reward_value: template.value.trim() || template.title.trim(),
    probability: odds[index],
    display_order: index,
  }))
}

/** All 24 doors. */
export function generateCalendar(
  pool: RewardTemplate[],
  options: GenerateOptions,
  random: Random = Math.random,
): Record<number, DraftReward[]> {
  const calendar: Record<number, DraftReward[]> = {}
  let previous: string[] = []
  for (let day = 1; day <= DOORS; day++) {
    calendar[day] = generateDay(day, pool, options, random, previous)
    previous = calendar[day].map((reward) => reward.title)
  }
  return calendar
}

/** The big days as typed in the admin ("6, 12, 18, 24"), cleaned up. */
export function parseDays(text: string): number[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,;]+/)
        .map((part) => Number(part))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= DOORS),
    ),
  ).sort((a, b) => a - b)
}
