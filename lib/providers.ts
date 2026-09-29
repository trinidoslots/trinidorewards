/**
 * Provider names as people write them.
 *
 * Stake's catalogue hands some providers over as their URL slug —
 * "donut-gaming", "nolimit-city", "netent" — rather than the display name.
 * Those are turned back into names here: known brands by their own spelling,
 * everything else by title-casing the words. A name that already has capitals
 * or spaces in it is taken as written and left alone.
 *
 * Used when a file is imported, by the one-off tidy of the catalogue, and when
 * a provider is shown, so older rows and old spins read right too.
 */

const KNOWN: Record<string, string> = {
  "3-oaks": "3 Oaks Gaming",
  "3oaks": "3 Oaks Gaming",
  avatarux: "AvatarUX",
  backseat: "Backseat Gaming",
  "backseat-gaming": "Backseat Gaming",
  bgaming: "BGaming",
  "big-time-gaming": "Big Time Gaming",
  bigtimegaming: "Big Time Gaming",
  blueprint: "Blueprint Gaming",
  "blueprint-gaming": "Blueprint Gaming",
  booming: "Booming Games",
  "booming-games": "Booming Games",
  btg: "Big Time Gaming",
  bullshark: "Bullshark Games",
  "bullshark-games": "Bullshark Games",
  elk: "ELK Studios",
  "elk-studios": "ELK Studios",
  evoplay: "Evoplay",
  fantasma: "Fantasma Games",
  "fantasma-games": "Fantasma Games",
  gamomat: "Gamomat",
  "games-global": "Games Global",
  hacksaw: "Hacksaw Gaming",
  "hacksaw-gaming": "Hacksaw Gaming",
  isoftbet: "iSoftBet",
  kalamba: "Kalamba Games",
  "kalamba-games": "Kalamba Games",
  "massive-studios": "Massive Studios",
  netent: "NetEnt",
  nolimit: "Nolimit City",
  "nolimit-city": "Nolimit City",
  nolimitcity: "Nolimit City",
  octoplay: "Octoplay",
  "peter-and-sons": "Peter & Sons",
  "peter-sons": "Peter & Sons",
  "pg-soft": "PG Soft",
  pgsoft: "PG Soft",
  "play-n-go": "Play'n GO",
  playngo: "Play'n GO",
  pragmatic: "Pragmatic Play",
  "pragmatic-play": "Pragmatic Play",
  pragmaticplay: "Pragmatic Play",
  "print-studios": "Print Studios",
  push: "Push Gaming",
  "push-gaming": "Push Gaming",
  pushgaming: "Push Gaming",
  quickspin: "Quickspin",
  "red-tiger": "Red Tiger",
  redtiger: "Red Tiger",
  relax: "Relax Gaming",
  "relax-gaming": "Relax Gaming",
  "relaxgaming": "Relax Gaming",
  slotmill: "Slotmill",
  thunderkick: "Thunderkick",
  "titan-gaming": "Titan Gaming",
  twist: "Twist Gaming",
  "twist-gaming": "Twist Gaming",
  yggdrasil: "Yggdrasil",
}

/** A slug: lower-case words joined by hyphens or underscores, no spaces. */
const SLUG = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/

function titleWord(word: string): string {
  if (!word) return word
  // No vowel at all reads as an abbreviation: "btg", "pg", "mg".
  if (!/[aeiouy]/.test(word) && /[a-z]/.test(word)) return word.toUpperCase()
  if (word === "and") return "&"
  return word[0].toUpperCase() + word.slice(1)
}

export function formatProvider(name: string | null | undefined): string | null {
  if (name === null || name === undefined) return null
  const text = String(name).replace(/\s+/g, " ").trim()
  if (!text) return null
  if (!SLUG.test(text)) return text
  const known = KNOWN[text] ?? KNOWN[text.replace(/_/g, "-")]
  if (known) return known
  return text.split(/[-_]/).map(titleWord).join(" ")
}
