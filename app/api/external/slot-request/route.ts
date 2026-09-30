import { submitSlotRequest, BonushuntApiError } from "@/lib/bonushunt-api"
import { getSiteSession } from "@/lib/site-session"

/**
 * A slot request to bonushunt.gg, for the signed-in viewer.
 *
 * Like guess-the-balance, this took the username from the body with no login
 * check, so anyone could file requests under any name with the site's key.
 * The name now comes from the signed session.
 */
export async function POST(request: Request) {
  const session = await getSiteSession()
  if (!session) return Response.json({ error: "Please log in to request a slot" }, { status: 401 })

  try {
    const body = await request.json().catch(() => null)
    const huntId = typeof body?.huntId === "string" || typeof body?.huntId === "number" ? String(body.huntId) : ""
    const slotName = typeof body?.slotName === "string" ? body.slotName.trim().slice(0, 120) : ""
    const provider = typeof body?.provider === "string" ? body.provider.trim().slice(0, 80) : undefined

    if (!huntId || !slotName) {
      return Response.json({ error: "huntId and slotName are required" }, { status: 400 })
    }

    const data = await submitSlotRequest({ huntId, username: session.username, slotName, provider })
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to submit slot request"
    console.error("[external] slot-request error:", message)
    return Response.json({ error: message }, { status })
  }
}
