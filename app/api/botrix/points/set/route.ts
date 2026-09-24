import { serviceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/**
 * Sets a user's points, for the Botrix integration.
 *
 * This had no check at all: anyone could POST a name and a number and set that
 * user's balance. It now needs BOTRIX_API_KEY as a bearer token, and is off
 * (503) until that variable is set.
 */
function authorised(request: Request): boolean | null {
  const expected = process.env.BOTRIX_API_KEY
  if (!expected) return null
  const header = request.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  return token.length === expected.length && token === expected
}

export async function POST(request: Request) {
  const allowed = authorised(request)
  if (allowed === null) return NextResponse.json({ error: "Not configured" }, { status: 503 })
  if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const supabase = serviceClient()
    const { username, points } = await request.json()

    if (!username || points === undefined || points === null) {
      return NextResponse.json({ error: "Username and points are required" }, { status: 400 })
    }

    const pointsValue = Number(points)
    if (Number.isNaN(pointsValue) || pointsValue < 0) {
      return NextResponse.json({ error: "Invalid points value" }, { status: 400 })
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle()

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update user points in database
    const { error: updateError } = await supabase
      .from("users")
      .update({
        points_balance: Math.floor(pointsValue),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("[v0] Error updating user points:", updateError)
      return NextResponse.json({ error: "Failed to update points in database" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully set ${username}'s points to ${Math.floor(pointsValue)}`,
      previousPoints: user.points_balance,
      newPoints: Math.floor(pointsValue),
    })
  } catch (error) {
    console.error("[v0] Error in set points endpoint:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
