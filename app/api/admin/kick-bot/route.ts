import { after } from "next/server"
import { requireAdmin, requireStaff } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { KICK_SLUG, SITE_URL } from "@/lib/discord/config"
import {
  botConnection,
  chatSubscriptions,
  disconnectBot,
  kickBotCredentials,
  kickBotRedirectUri,
  sendBotMessage,
  subscribeChat,
} from "@/lib/kick-bot/client"
import { BOT_EVENTS, botEvents, botTournamentOpen, botTournamentWinner, saveBotEvents } from "@/lib/kick-bot/announce"

/**
 * The admin side of the Kick bot.
 *
 * GET  — status for the Kick bot page: app, connection, chat subscription,
 *        which announcements are on, and the latest stored chat.
 * POST — { action: "subscribe-chat" | "send" | "events" | "disconnect" }, or
 *        { action: "announce", kind: "tournament-open" | "tournament-winner", id }
 *        which the tournaments page calls (moderators run tournaments too).
 */

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const origin = new URL(request.url).origin
  const credentials = kickBotCredentials()
  const connection = await botConnection().catch(() => null)

  const result: Record<string, unknown> = {
    app: credentials ? { configured: true, ownApp: credentials.ownApp } : { configured: false, ownApp: false },
    redirectUri: kickBotRedirectUri(origin),
    webhookUrl: `${SITE_URL}/api/kick/webhook`,
    channelSlug: KICK_SLUG,
    connection,
    events: { list: BOT_EVENTS, enabled: await botEvents() },
  }

  if (connection?.connected) {
    result.chat = await chatSubscriptions()
      .then((subs) => ({ ok: true, subscribed: subs.length > 0 }))
      .catch((e: Error) => ({ ok: false, error: e.message }))
  }

  const client = serviceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [recent, today] = await Promise.all([
    client
      .from("kick_chat_messages")
      .select("message_id, username, content, is_mod, sent_at")
      .order("sent_at", { ascending: false })
      .limit(50),
    client.from("kick_chat_messages").select("message_id", { count: "exact", head: true }).gte("sent_at", since),
  ])
  result.messages = recent.error
    ? { ok: false, error: `${recent.error.message} – run scripts/088_kick_chat_messages.sql` }
    : { ok: true, recent: recent.data ?? [], last24h: today.count ?? 0 }

  return Response.json(result)
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (body.action === "announce") {
    const auth = await requireStaff()
    if (!auth.ok) return auth.response
    const id = typeof body.id === "string" ? body.id : ""
    if (!id) return Response.json({ error: "id is required" }, { status: 400 })
    // After the response: the tournament page never waits on Kick.
    if (body.kind === "tournament-open") after(() => botTournamentOpen(id))
    else if (body.kind === "tournament-winner") after(() => botTournamentWinner(id))
    else return Response.json({ error: "Unknown kind" }, { status: 400 })
    return Response.json({ ok: true })
  }

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    switch (body.action) {
      case "subscribe-chat":
        return Response.json({ ok: true, message: await subscribeChat() })
      case "send": {
        const content = typeof body.content === "string" ? body.content.trim() : ""
        if (!content) return Response.json({ error: "Write a message first." }, { status: 400 })
        await sendBotMessage(content)
        return Response.json({ ok: true, message: "Sent." })
      }
      case "events":
        return Response.json({
          ok: true,
          message: "Saved.",
          enabled: await saveBotEvents((body.events ?? {}) as Record<string, unknown>),
        })
      case "disconnect":
        await disconnectBot()
        return Response.json({ ok: true, message: "Disconnected." })
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : "Failed"
    console.error("[admin/kick-bot]", body.action, problem)
    return Response.json({ error: message }, { status: 500 })
  }
}
