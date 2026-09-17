import { submitSlotRequest, BonushuntApiError } from "@/lib/bonushunt-api"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { huntId, username, slotName, provider } = body

    if (!huntId || !username || !slotName) {
      return Response.json({ error: "huntId, username, and slotName are required" }, { status: 400 })
    }

    const data = await submitSlotRequest({ huntId, username, slotName, provider })
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to submit slot request"
    console.error("[v0] External slot-request error:", message)
    return Response.json({ error: message }, { status })
  }
}
