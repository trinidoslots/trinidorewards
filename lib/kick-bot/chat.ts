import { after } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { SITE_URL } from "@/lib/discord/config"
import { getActiveHunt } from "@/lib/active-hunt"
import { likeExact } from "@/lib/like"
import { moneyExact } from "@/lib/leaderboard-format"
import { isModOrBroadcaster, type KickBadge } from "@/lib/kick-chat"
import { KICK_BOT_USERNAME, botConnection, sendBotMessage } from "@/lib/kick-bot/client"
import { botPredictionsClosed } from "@/lib/kick-bot/announce"
import { drawPointsRaffle, enterPointsRaffle } from "@/lib/points-raffle"

/**
 * One chat message from Kick's chat.message.sent webhook.
 *
 * Stored for seven days, counted as chat activity for points (the same table
 * the OBS recorder writes, so a grant works with or without OBS open), and
 * answered when it is a command the bot knows.
 */

const KEEP_DAYS = 7
const PRUNE_EVERY_MS = 60 * 60 * 1000
const COMMAND_COOLDOWN_MS = 30_000
const WINDOW_CHECK_EVERY_MS = 20_000

type ChatEvent = {
  message_id?: string
  content?: string
  created_at?: string
  sender?: {
    user_id?: number
    username?: string
    identity?: { badges?: KickBadge[] }
  }
}

// Per instance: each warm function prunes at most once an hour and looks at
// the prediction window at most every 20 seconds. Losing these on a cold start
// costs one extra cheap query, nothing more.
let lastPrune = 0
let lastWindowCheck = 0

export async function handleChatMessage(event: ChatEvent): Promise<void> {
  const messageId = typeof event.message_id === "string" ? event.message_id : ""
  const username = event.sender?.username?.trim() ?? ""
  const content = typeof event.content === "string" ? event.content : ""
  if (!messageId || !username || !content) return

  const kickId = Number.isFinite(event.sender?.user_id) ? String(event.sender!.user_id) : null
  const sentAt = Number.isFinite(Date.parse(event.created_at ?? "")) ? new Date(event.created_at!).toISOString() : new Date().toISOString()
  const client = serviceClient()

  // The primary key is the duplicate check: Kick redelivers until it sees a 2xx,
  // and a message already here was handled the first time.
  const { data: inserted, error } = await client
    .from("kick_bot_chat")
    .upsert(
      {
        message_id: messageId.slice(0, 64),
        kick_id: kickId,
        username: username.slice(0, 64),
        content: content.slice(0, 2000),
        is_mod: isModOrBroadcaster(event.sender?.identity?.badges),
        sent_at: sentAt,
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    )
    .select("message_id")
  if (error) throw new Error(`kick_bot_chat: ${error.message} – has scripts/088 been run?`)
  if (!inserted?.length) return

  const fromBot = username.toLowerCase() === KICK_BOT_USERNAME

  if (!fromBot && kickId) {
    const { error: activityError } = await client.rpc("record_chat_activity", {
      p_rows: [{ kick_id: kickId, username, last_message_at: sentAt, message_count: 1 }],
    })
    if (activityError) console.error("[kick-bot] chat activity not recorded:", activityError)
  }

  if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
    lastPrune = Date.now()
    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error: pruneError } = await client.from("kick_bot_chat").delete().lt("sent_at", cutoff)
    if (pruneError) console.error("[kick-bot] prune failed:", pruneError)
  }

  if (fromBot) return

  // The points raffle (lib/points-raffle.ts): the keyword enters, and the
  // first message after the time is up has it drawn.
  const raffle = await enterPointsRaffle({ kickId, username, content, sentAt }).catch((problem) => {
    console.error("[kick-bot] points raffle:", problem)
    return { drawId: null }
  })
  if (raffle.drawId) {
    const drawId = raffle.drawId
    after(() => drawPointsRaffle(drawId).then(() => undefined).catch((problem) => console.error("[kick-bot] points raffle draw:", problem)))
  }

  // Replies go out after the webhook has answered: Kick wants its 200 quickly.
  const command = content.trim().toLowerCase().split(/\s+/)[0]
  if (command === "!prediction" || command === "!predict") {
    after(() => answerPrediction(messageId, kickId, username).catch((problem) => console.error("[kick-bot] !prediction:", problem)))
  }

  if (Date.now() - lastWindowCheck > WINDOW_CHECK_EVERY_MS) {
    lastWindowCheck = Date.now()
    after(() => announceExpiredWindow().catch((problem) => console.error("[kick-bot] window check:", problem)))
  }
}

/** Has this person asked within the cooldown already? Read from the stored chat, so it holds across instances. */
async function askedRecently(kickId: string | null, username: string, messageId: string): Promise<boolean> {
  const since = new Date(Date.now() - COMMAND_COOLDOWN_MS).toISOString()
  let query = serviceClient()
    .from("kick_bot_chat")
    .select("message_id", { count: "exact", head: true })
    .neq("message_id", messageId)
    .gte("sent_at", since)
    .ilike("content", "!predict%")
  query = kickId ? query.eq("kick_id", kickId) : query.ilike("username", likeExact(username))
  const { count } = await query
  return (count ?? 0) > 0
}

async function answerPrediction(messageId: string, kickId: string | null, username: string) {
  if (!(await botConnection()).connected) return
  if (await askedRecently(kickId, username, messageId)) return

  const client = serviceClient()
  const hunt = await getActiveHunt(client)
  if (!hunt) {
    await sendBotMessage(`@${username} there is no bonus hunt running right now.`, messageId)
    return
  }

  // Predictions are made on the site, signed in with Kick, so the site
  // username is the Kick name.
  const { data: prediction } = await client
    .from("hunt_predictions")
    .select("predicted_end_balance, predicted_max_multiplier, predicted_best_game")
    .eq("hunt_id", hunt.id)
    .ilike("username", likeExact(username))
    .maybeSingle()

  if (!prediction) {
    const { data: window } = await client
      .from("prediction_windows")
      .select("status, closes_at")
      .eq("hunt_id", hunt.id)
      .maybeSingle()
    const open = window?.status === "open" && Date.parse(window.closes_at ?? "") > Date.now()
    await sendBotMessage(
      open
        ? `@${username} you have no prediction for this hunt yet – predictions are open at ${SITE_URL}/bonushunt`
        : `@${username} you have no prediction for this hunt.`,
      messageId,
    )
    return
  }

  const parts = [`final balance ${moneyExact(Number(prediction.predicted_end_balance) || 0)}`]
  if (prediction.predicted_max_multiplier != null) parts.push(`highest multi ${Number(prediction.predicted_max_multiplier).toLocaleString("en-US")}x`)
  if (prediction.predicted_best_game) parts.push(`best game ${prediction.predicted_best_game}`)
  await sendBotMessage(`@${username} your prediction: ${parts.join(" · ")}`, messageId)
}

/**
 * A prediction window closes on its own after its time is up; nothing calls
 * the API then. Chat is busy while it matters, so incoming messages are what
 * notice that the window has run out — and the "closed" post goes out once.
 */
async function announceExpiredWindow() {
  const client = serviceClient()
  const hunt = await getActiveHunt(client)
  if (!hunt) return
  const { data: window } = await client
    .from("prediction_windows")
    .select("status, opens_at, closes_at")
    .eq("hunt_id", hunt.id)
    .maybeSingle()
  if (!window?.opens_at || !window.closes_at) return
  // Only a window that ran out within the last hour: an old one that was never
  // closed by hand is not news.
  const closesAt = Date.parse(window.closes_at)
  if (window.status === "open" && closesAt <= Date.now() && Date.now() - closesAt < 60 * 60 * 1000) {
    await botPredictionsClosed(hunt.id, window.opens_at)
  }
}
