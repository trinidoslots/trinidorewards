import { getExternalHunt, BonushuntApiError } from "@/lib/bonushunt-api"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await getExternalHunt(id)
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to fetch hunt"
    console.error("[v0] External hunt detail error:", message)
    return Response.json({ error: message }, { status })
  }
}
