/** Shared shape and vocabulary for the winner log. */

export type WinSource = "giveaway" | "prediction" | "tournament" | "raffle" | "manual"

export type WinLog = {
  id: string
  user_id: string | null
  username: string
  source: WinSource
  source_ref: string | null
  prize: string
  amount: number | null
  points: number | null
  note: string | null
  status: string
  created_at: string
  paid_at: string | null
}

export const WIN_SOURCES: { id: WinSource; label: string; accent: "purple" | "amber" | "blue" | "pink" | "slate" }[] = [
  { id: "giveaway", label: "Giveaway", accent: "purple" },
  { id: "prediction", label: "Prediction", accent: "amber" },
  { id: "tournament", label: "Tournament", accent: "blue" },
  { id: "raffle", label: "Raffle", accent: "pink" },
  { id: "manual", label: "Manual", accent: "slate" },
]

export function sourceMeta(source: string) {
  return WIN_SOURCES.find((entry) => entry.id === source) ?? WIN_SOURCES[WIN_SOURCES.length - 1]
}

/** "$250" / "1,500 pts" / "—" — whichever of the two was actually filled in. */
export function winValue(win: Pick<WinLog, "amount" | "points">): string {
  const parts: string[] = []
  const amount = Number(win.amount)
  const points = Number(win.points)
  if (Number.isFinite(amount) && amount !== 0) parts.push(`$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`)
  if (Number.isFinite(points) && points !== 0) parts.push(`${points.toLocaleString("en-US")} pts`)
  return parts.join(" · ") || "—"
}
