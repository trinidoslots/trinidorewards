/**
 * Reading a wager export into leaderboard entries.
 *
 * Casinos export these with wildly different headers and separators, and a
 * paste from a spreadsheet arrives with CRLF line endings and quoted values.
 * The old parser split on "," and lowercased the header, which meant a file
 * with a quoted name, a thousands separator or a semicolon separator imported
 * as NaN wagers without saying anything.
 */

export type CsvRow = { username: string; wager_amount: number }

export type CsvResult = {
  rows: CsvRow[]
  /** Lines that could not be read, with the reason, so nothing fails silently. */
  skipped: { line: number; reason: string }[]
}

const USERNAME_HEADERS = ["username", "user", "name", "player", "nickname"]
const WAGER_HEADERS = ["wager_amount", "wager", "wagered", "amount", "total", "points", "volume"]

/** Comma or semicolon, whichever the header row actually uses. */
function detectSeparator(header: string): string {
  return header.split(";").length > header.split(",").length ? ";" : ","
}

/** Splits one line, honouring double quotes around a value. */
export function splitLine(line: string, separator: string): string[] {
  const out: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') {
      // A doubled quote inside a quoted value is a literal quote.
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index++
      } else {
        quoted = !quoted
      }
    } else if (char === separator && !quoted) {
      out.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  out.push(current.trim())
  return out
}

/**
 * "1.234,56" / "1,234.56" / "$1 234" as a number.
 *
 * The last separator with two digits after it is the decimal point; everything
 * else is grouping. Guessing the other way round turns 1,234 into 1.234.
 */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim()
  if (!cleaned) return Number.NaN

  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  const decimalAt = Math.max(lastComma, lastDot)

  if (decimalAt === -1) return Number(cleaned)

  const tail = cleaned.slice(decimalAt + 1)
  // Three digits after the last separator means it was grouping, not a decimal.
  if (tail.length === 3 || tail.length === 0) return Number(cleaned.replace(/[.,]/g, ""))

  const whole = cleaned.slice(0, decimalAt).replace(/[.,]/g, "")
  return Number(`${whole}.${tail}`)
}

export function parseLeaderboardCsv(text: string): CsvResult {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return { rows: [], skipped: [] }

  const separator = detectSeparator(lines[0])
  const headers = splitLine(lines[0], separator).map((header) => header.toLowerCase().replace(/\s+/g, "_"))

  const nameAt = headers.findIndex((header) => USERNAME_HEADERS.includes(header))
  const wagerAt = headers.findIndex((header) => WAGER_HEADERS.includes(header))

  if (nameAt === -1 || wagerAt === -1) {
    return {
      rows: [],
      skipped: [{ line: 1, reason: `Needs a username column and a wager column. Found: ${headers.join(", ")}` }],
    }
  }

  const rows: CsvRow[] = []
  const skipped: CsvResult["skipped"] = []

  lines.slice(1).forEach((line, index) => {
    const values = splitLine(line, separator)
    const username = (values[nameAt] ?? "").trim()
    const wager = parseAmount(values[wagerAt] ?? "")

    if (!username) {
      skipped.push({ line: index + 2, reason: "No username" })
      return
    }
    if (!Number.isFinite(wager)) {
      skipped.push({ line: index + 2, reason: `"${values[wagerAt] ?? ""}" is not a number` })
      return
    }
    rows.push({ username, wager_amount: wager })
  })

  return { rows, skipped }
}
