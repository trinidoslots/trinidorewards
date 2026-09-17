import { getExternalStats, BonushuntApiError } from "@/lib/bonushunt-api"

export async function GET() {
  try {
    const data = await getExternalStats()
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to fetch stats"
    console.error("[v0] External stats error:", message)
    return Response.json({ error: message }, { status })
  }
}
