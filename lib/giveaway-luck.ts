/**
 * Subscriber luck for the Kick giveaway.
 *
 * Luck is a whole number from 1 to 10: a subscriber is drawn as if they had
 * entered that many times, everyone else once. 1 is a fair draw, 3 makes each
 * subscriber three times as likely as a non-subscriber to win.
 *
 * Kept free of React so the odds can be checked on their own.
 */

export const MIN_LUCK = 1
export const MAX_LUCK = 10

/** The badge types Kick sends that make someone a subscriber. */
export const SUBSCRIBER_TYPES = ["subscriber", "founder"]

export function clampLuck(value: unknown): number {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number)) return MIN_LUCK
  return Math.min(MAX_LUCK, Math.max(MIN_LUCK, number))
}

export function isSubscriber(badgeTypes: string[] | undefined): boolean {
  return (badgeTypes ?? []).some((type) => SUBSCRIBER_TYPES.includes(type))
}

/**
 * One name, drawn with each name's weight as its number of tickets.
 *
 * `random` is Math.random unless a test passes its own. A weight that is not a
 * positive number counts as 1, so a bad value can never remove someone from
 * the draw.
 */
export function pickWeighted(names: string[], weightOf: (name: string) => number, random: () => number = Math.random): string | null {
  if (names.length === 0) return null
  const weights = names.map((name) => {
    const weight = weightOf(name)
    return Number.isFinite(weight) && weight > 0 ? weight : 1
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let ticket = random() * total
  for (let index = 0; index < names.length; index++) {
    ticket -= weights[index]
    if (ticket < 0) return names[index]
  }
  return names[names.length - 1]
}

/** Each group's chance of winning, in percent, for the numbers shown next to the slider. */
export function odds(subscribers: number, others: number, luck: number) {
  const total = subscribers * luck + others
  if (total === 0) return { subscriber: 0, other: 0 }
  return { subscriber: (luck / total) * 100, other: (1 / total) * 100 }
}
