export function calculateRaffleStatus(startDate: string, endDate: string): "upcoming" | "active" | "ended" {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (now < start) {
    return "upcoming"
  } else if (now >= start && now < end) {
    return "active"
  } else {
    return "ended"
  }
}

export function isEndingSoon(endDate: string): boolean {
  const now = new Date()
  const end = new Date(endDate)
  const oneHourInMs = 60 * 60 * 1000
  const timeRemaining = end.getTime() - now.getTime()

  return timeRemaining > 0 && timeRemaining <= oneHourInMs
}

export function getTimeRemaining(endDate: string): {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
} {
  const now = new Date()
  const end = new Date(endDate)
  const timeRemaining = end.getTime() - now.getTime()

  if (timeRemaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }

  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, expired: false }
}

export function formatDrawDate(drawDate: string): string {
  const date = new Date(drawDate)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export type DrawEntry = { id: string; username: string; tickets_purchased: number }

export type DrawResult = { username: string; entryId: string; ticketNumber: number; totalTickets: number }

/**
 * Picks a winner, weighted by tickets held.
 *
 * Every ticket is one chance, which is the whole point of selling more than
 * one — picking uniformly among *entrants* would make the second ticket
 * worthless. Walks the cumulative total rather than building an array of every
 * ticket, so a raffle with a large cap does not allocate a huge list.
 *
 * `random` is injectable so the draw can be tested; it must return [0, 1).
 */
export function drawWinner(entries: DrawEntry[], random: () => number = Math.random): DrawResult | null {
  const eligible = entries.filter((entry) => (Number(entry.tickets_purchased) || 0) > 0)
  const totalTickets = eligible.reduce((sum, entry) => sum + (Number(entry.tickets_purchased) || 0), 0)
  if (totalTickets <= 0) return null

  // 1-based: "ticket #1" is the first ticket, not the zeroth.
  const ticketNumber = Math.min(totalTickets, Math.floor(random() * totalTickets) + 1)

  let seen = 0
  for (const entry of eligible) {
    seen += Number(entry.tickets_purchased) || 0
    if (ticketNumber <= seen) {
      return { username: entry.username, entryId: entry.id, ticketNumber, totalTickets }
    }
  }

  // Unreachable while the totals agree; falling back to the last entry beats
  // returning null and telling the admin the raffle has no entries.
  const last = eligible[eligible.length - 1]
  return { username: last.username, entryId: last.id, ticketNumber, totalTickets }
}

export const DURATION_UNITS = [
  { id: "minutes", label: "minutes", ms: 60_000 },
  { id: "hours", label: "hours", ms: 3_600_000 },
  { id: "days", label: "days", ms: 86_400_000 },
] as const

export type DurationUnit = (typeof DURATION_UNITS)[number]["id"]

export function durationToMs(amount: number, unit: DurationUnit): number {
  const found = DURATION_UNITS.find((entry) => entry.id === unit) ?? DURATION_UNITS[1]
  return Math.max(0, Math.round(amount)) * found.ms
}

/**
 * A span back into the largest unit that divides it evenly.
 *
 * So a raffle stored as running for 7200000ms comes back as "2 hours" rather
 * than "120 minutes" — which is what someone editing it would expect to see,
 * since it is what they typed.
 */
export function msToDuration(ms: number): { amount: number; unit: DurationUnit } {
  const value = Math.max(0, Math.round(Number(ms) || 0))
  for (const unit of [...DURATION_UNITS].reverse()) {
    if (value >= unit.ms && value % unit.ms === 0) {
      return { amount: value / unit.ms, unit: unit.id }
    }
  }
  // Nothing divides evenly — minutes, rounded up, so a 90-second raffle does
  // not come back as zero and silently close the moment it is saved.
  return { amount: Math.max(1, Math.ceil(value / 60_000)), unit: "minutes" }
}
