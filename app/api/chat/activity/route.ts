import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { createServerClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { isAllowedAdmin } from "@/lib/admin-host"
import { collapseChatters, readChatter, type Chatter } from "@/lib/points-activity"

/**
 * Where "who was in chat" is recorded.
 *
 * Kick chat is read over a WebSocket, which a serverless function cannot hold
 * open — so the page that is already reading it does the recording and posts
 * batches here. In practice that is the OBS source, which runs for the whole
 * stream: exactly the window in which points matter.
 *
 * Two callers are allowed:
 *   - a page holding the recorder token (the OBS browser source URL)
 *   - a signed-in admin (the giveaway page, which is already behind /admin)
 *
 * Everything else is turned away. Without a check, anyone who found this URL
 * could claim to have been in chat and collect the next grant.
 */

const MAX_BATCH = 400

/** Compared in constant time so the token cannot be guessed a byte at a time. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

type Denial = { ok: false; status: number; error: string }

async function authorise(request: Request, provided: unknown): Promise<{ ok: true } | Denial> {
  const expected = process.env.RECORDER_TOKEN

  if (typeof provided === "string" && provided.length > 0) {
    // Fails closed on purpose. An unset token used to mean "allow", which is how
    // the last attempt at this ended up looking healthy while doing nothing —
    // a feature that is off should say so, not pretend.
    if (!expected) {
      return { ok: false, status: 503, error: "RECORDER_TOKEN is not configured on the server" }
    }
    if (tokenMatches(provided, expected)) return { ok: true }
    return { ok: false, status: 401, error: "Invalid recorder token" }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && isAllowedAdmin(user.email, process.env.ADMIN_EMAILS)) return { ok: true }

  return { ok: false, status: 401, error: "Not authorised to record chat activity" }
}

export async function POST(request: Request) {
  let body: { token?: unknown; chatters?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 })
  }

  const allowed = await authorise(request, body.token)
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status })
  }

  if (!Array.isArray(body.chatters)) {
    return NextResponse.json({ error: "chatters must be an array" }, { status: 400 })
  }

  // Malformed entries are dropped rather than failing the batch: one odd
  // payload from a chat frame must not cost us everyone else in that flush.
  const parsed: Chatter[] = []
  for (const raw of body.chatters.slice(0, MAX_BATCH)) {
    const chatter = readChatter(raw)
    if (chatter) parsed.push(chatter)
  }

  const chatters = collapseChatters(parsed)
  if (chatters.length === 0) {
    return NextResponse.json({ ok: true, recorded: 0 })
  }

  // The moment is computed here from the browser's stopwatch (how long ago),
  // never from its clock. A wrong system clock on the streaming PC would
  // otherwise put every chatter outside the window, or inside it forever.
  const now = Date.now()
  const rows = chatters.map((chatter) => ({
    kick_id: chatter.kickId,
    username: chatter.username,
    last_message_at: new Date(now - chatter.agoMs).toISOString(),
    message_count: chatter.messages,
  }))

  const client = serviceClient()

  // A plain upsert would overwrite message_count with this batch's count and
  // could move last_message_at backwards if two flushes arrive out of order.
  // The function keeps the later timestamp and adds the counts.
  const { error } = await client.rpc("record_chat_activity", { p_rows: rows })

  if (error) {
    console.error("[points] Could not record chat activity:", error)
    return NextResponse.json({ error: "Could not record chat activity" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recorded: rows.length })
}
