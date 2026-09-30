import { submitGuessTheBalance, BonushuntApiError } from "@/lib/bonushunt-api"
import { getSiteSession } from "@/lib/site-session"

/**
 * A guess in the bonushunt.gg guess-the-balance, for the signed-in viewer.
 *
 * This used to take the username from the request body with no login check,
 * and accept a batch of up to 500 guesses. Anyone could post guesses under
 * any name, or flood the game, with the site's own bonushunt.gg key. The name
 * now comes from the signed session, and one request is one guess.
 */
export async function POST(request: Request) {
  const session = await getSiteSession()
  if (!session) return Response.json({ error: "Please log in to submit a guess" }, { status: 401 })

  try {
    const body = await request.json().catch(() => null)
    const huntId = typeof body?.huntId === "string" || typeof body?.huntId === "number" ? String(body.huntId) : ""
    const guessAmount = Number(body?.guessAmount)

    if (!huntId) return Response.json({ error: "huntId is required" }, { status: 400 })
    if (!Number.isFinite(guessAmount) || guessAmount < 0) {
      return Response.json({ error: "Enter a valid guess amount" }, { status: 400 })
    }

    const data = await submitGuessTheBalance({ huntId, username: session.username, guessAmount })
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to submit guess"
    console.error("[external] guess-the-balance error:", message)
    return Response.json({ error: message }, { status })
  }
}
