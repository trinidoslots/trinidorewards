import { claimOnce } from "@/lib/discord/state"
import { handleMetadata, handleStatus, verifyKickRequest } from "@/lib/discord/kick"

/**
 * Kick's event webhook — set as the Webhook URL of the site's Kick app. Kick
 * calls it when the stream starts, stops or changes title, and the Discord
 * live post follows. Requests are RSA-signed by Kick; unsigned ones are refused.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: Request) {
  const raw = await request.text()
  if (!(await verifyKickRequest(request.headers, raw))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Five minutes either way, as for the site's own webhooks: an old delivery
  // replayed later must not flip the live post.
  const sentAt = Date.parse(request.headers.get("kick-event-message-timestamp") ?? "")
  if (Number.isFinite(sentAt) && Math.abs(Date.now() - sentAt) > 5 * 60 * 1000) {
    return Response.json({ ok: true, stale: true })
  }

  const type = request.headers.get("kick-event-type")
  const messageId = request.headers.get("kick-event-message-id")!

  try {
    // Kick redelivers until it sees a 2xx; each message is handled once.
    if (!(await claimOnce(`kick-msg:${messageId}`))) return Response.json({ ok: true, duplicate: true })
    const event = JSON.parse(raw)
    if (type === "livestream.status.updated") await handleStatus(event)
    else if (type === "livestream.metadata.updated") await handleMetadata(event)
    return Response.json({ ok: true })
  } catch (problem) {
    console.error("[kick-webhook]", type, problem)
    // Still a 200: a retry would be skipped as a duplicate anyway, and the
    // failure is in the log.
    return Response.json({ ok: false })
  }
}
