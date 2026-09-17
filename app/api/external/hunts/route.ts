import { getExternalHunts, BonushuntApiError } from "@/lib/bonushunt-api"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = searchParams.get("limit")
  const offset = searchParams.get("offset")
  const status = searchParams.get("status")

  try {
    const data = await getExternalHunts({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status: status === "opening" || status === "completed" ? status : undefined,
    })
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to fetch hunts"
    console.error("[v0] External hunts error:", message)
    return Response.json({ error: message }, { status })
  }
}
