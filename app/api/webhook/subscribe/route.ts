import { NextRequest, NextResponse } from "next/server"

interface SubscriptionRequest {
  event: string
  broadcaster_user_id: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SubscriptionRequest = await request.json()

    if (!body.event || !body.broadcaster_user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const kickAccessToken = process.env.KICK_ACCESS_TOKEN
    if (!kickAccessToken) {
      return NextResponse.json(
        { error: "Kick access token not configured" },
        { status: 500 }
      )
    }

    // Subscribe to Kick event
    const response = await fetch("https://api.kick.com/public/v1/events/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${kickAccessToken}`,
      },
      body: JSON.stringify({
        event: body.event,
        version: 1,
        broadcaster_user_id: parseInt(body.broadcaster_user_id),
        transport: {
          method: "webhook",
          callback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook`,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] Kick subscription error:", error)
      return NextResponse.json(
        { error: "Failed to subscribe to event", details: error },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log("[v0] Successfully subscribed to event:", body.event)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("[v0] Subscription endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
