import { submitGuessTheBalance, BonushuntApiError } from "@/lib/bonushunt-api"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { huntId, username, guessAmount, guesses } = body

    if (!huntId) {
      return Response.json({ error: "huntId is required" }, { status: 400 })
    }

    if (!guesses && (!username || guessAmount === undefined)) {
      return Response.json(
        { error: "Provide either username + guessAmount (single) or guesses[] (batch)" },
        { status: 400 },
      )
    }

    if (Array.isArray(guesses) && guesses.length > 500) {
      return Response.json({ error: "Batch mode supports up to 500 guesses per request" }, { status: 400 })
    }

    const data = await submitGuessTheBalance({ huntId, username, guessAmount, guesses })
    return Response.json(data)
  } catch (error) {
    const status = error instanceof BonushuntApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Failed to submit guess"
    console.error("[v0] External guess-the-balance error:", message)
    return Response.json({ error: message }, { status })
  }
}
