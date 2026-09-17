import { getGuessTheBalanceStatus, BonushuntApiError } from "@/lib/bonushunt-api"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await getGuessTheBalanceStatus(id)
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to fetch guess-the-balance status"
    console.error("[v0] External guess-the-balance status error:", message)
    return Response.json({ error: message }, { status })
  }
}
