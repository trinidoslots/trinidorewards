import { NextRequest, NextResponse } from "next/server"
import { trackActiveUser, getActiveUsers } from "@/lib/active-users-tracker"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, kick_id } = body

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    // Track the user and reset their 5-minute timer
    await trackActiveUser(username, kick_id || "")

    return NextResponse.json({ success: true, message: "User activity tracked" })
  } catch (error) {
    console.error("Error tracking user:", error)
    return NextResponse.json({ error: "Failed to track user" }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Get all currently active users (within 5-minute window)
    const activeUsers = getActiveUsers()

    return NextResponse.json({
      success: true,
      active_users: activeUsers,
      count: activeUsers.length,
      usernames: activeUsers.map((u) => u.username),
    })
  } catch (error) {
    console.error("Error fetching active users:", error)
    return NextResponse.json({ error: "Failed to fetch active users" }, { status: 500 })
  }
}
