import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export interface IncomingKickMessage {
  channel: string
  username: string
  content: string
  isSubscriber?: boolean
  raw?: unknown
}

export async function forwardChatMessage(message: IncomingKickMessage) {
  const { error } = await supabaseAdmin.from("chat_messages").insert({
    channel: message.channel.trim().toLowerCase(),
    username: message.username,
    message: message.content,
    is_sub: message.isSubscriber ?? false,
    raw: message.raw ?? null,
  })
  if (error) console.error("[kick-listener] failed to forward message to Supabase:", error)
}
