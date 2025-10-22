import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
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
