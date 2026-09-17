import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { forwardChatMessage } from "@/app/api/services/kick-listener-supabase-bridge"

function createWebhookSupabaseClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface KickChatMessageEvent {
  event_type: string
  event_id: string
  created_at: string
  data: {
    broadcaster_user_id: string
    broadcaster_user_name: string
    chatter_user_id: string
    chatter_user_name: string
    message: {
      text: string
    }
  }
}

// Verify Kick webhook signature
function verifyKickSignature(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret)
  const digest = hmac.update(body).digest("hex")
  return digest === signature
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-signature-ed25519") || ""
    const timestamp = request.headers.get("x-signature-timestamp") || ""

    // Verify signature using Kick's verification method
    const secret = process.env.KICK_WEBHOOK_SECRET || ""
    const signedContent = timestamp + body

    const isValid = verifyKickSignature(signedContent, signature, secret)
    if (!isValid) {
      console.error("[v0] Invalid Kick webhook signature")
      return new Response("Invalid signature", { status: 401 })
    }

    const event: KickChatMessageEvent = JSON.parse(body)

    // Handle chat.message.sent event
    if (event.event_type === "chat.message.sent") {
      const supabase = createWebhookSupabaseClient()
      const channel = event.data.broadcaster_user_name.trim().toLowerCase()
      const messageText = event.data.message.text

      await forwardChatMessage({
        channel,
        username: event.data.chatter_user_name,
        content: messageText,
        raw: event,
      })

      await supabase.from("kick_channel_monitor_status").upsert({
        channel,
        status: "connected",
        last_heartbeat_at: new Date().toISOString(),
        last_message_at: event.created_at || new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "channel" })

      // Track user activity (5-minute window)
      const { error: trackError } = await supabase
        .from("user_messages")
        .upsert(
          {
            username: event.data.chatter_user_name,
            kick_id: event.data.chatter_user_id,
            last_message_time: new Date().toISOString(),
          },
          { onConflict: "kick_id" }
        )

      if (trackError) {
        console.error("[v0] Error tracking user message:", trackError)
      }

      return new Response("OK", { status: 200 })
    }

    return new Response("OK", { status: 200 })
  } catch (error) {
    console.error("[v0] Webhook error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}
