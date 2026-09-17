import { getCurrentExternalHuntMapped, BonushuntApiError } from "@/lib/bonushunt-api"

// Returns the latest opening hunt (fallback: most recent) mapped to the
// local bonus_hunts row shape so the public page/client can render it directly.
export async function GET() {
  try {
    const { hunt, rows } = await getCurrentExternalHuntMapped()
    const isOpening = hunt?.status === "opening" || (hunt?.status == null && hunt?.isOpening === true)
    return Response.json({
      hunt,
      huntId: hunt?.id ?? null,
      status: hunt?.status ?? (isOpening ? "opening" : "completed"),
      rows,
      isOpening,
    })
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to fetch current hunt"
    console.error("[v0] External current-hunt error:", message)
    return Response.json({ error: message, rows: [] }, { status })
  }
}
