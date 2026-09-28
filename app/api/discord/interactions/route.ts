import { after } from "next/server"
import { discordConfig } from "@/lib/discord/config"
import { verifyDiscordRequest } from "@/lib/discord/verify"
import { EPHEMERAL, handleButton, isPublic, quickReply, runCommand, type Interaction } from "@/lib/discord/commands"

/**
 * Discord's Interactions Endpoint URL: every slash command and button click
 * arrives here as a signed POST. This is what lets the bot live on Vercel —
 * there is no gateway connection to keep open, Discord comes to us.
 *
 * Set in the developer portal under General Information → Interactions
 * Endpoint URL. Discord tests the signature check when the URL is saved.
 */

export const dynamic = "force-dynamic"
// /setup makes a few dozen API calls and can meet Discord's rate limits.
export const maxDuration = 60

const PING = 1
const COMMAND = 2
const COMPONENT = 3

const json = (body: unknown) => Response.json(body)

export async function POST(request: Request) {
  let config
  try {
    config = discordConfig()
  } catch (problem) {
    console.error("[discord]", problem)
    return new Response("Discord is not configured", { status: 503 })
  }

  const raw = await request.text()
  const valid = verifyDiscordRequest(
    raw,
    request.headers.get("x-signature-ed25519"),
    request.headers.get("x-signature-timestamp"),
    config.publicKey,
  )
  if (!valid) return new Response("Invalid signature", { status: 401 })

  const interaction = JSON.parse(raw) as Interaction
  if (interaction.type === PING) return json({ type: 1 })

  // The commands are registered on one server only; anything else is not ours to answer.
  if (interaction.guild_id !== config.guildId) {
    return json({ type: 4, data: { content: "This bot only works on the TrinidoRewards server.", flags: EPHEMERAL } })
  }

  if (interaction.type === COMPONENT && interaction.data?.custom_id?.startsWith("trinido:")) {
    // A role add/remove is one quick call, so this answers directly.
    const content = await handleButton(interaction).catch((problem: Error) => {
      console.error("[discord] button failed:", problem)
      return `⚠️ ${problem.message}`
    })
    return json({ type: 4, data: { content, flags: EPHEMERAL } })
  }

  if (interaction.type === COMMAND) {
    const quick = quickReply(interaction)
    if (quick) return json({ type: 4, data: quick })

    // "Bot is thinking…" now, the real answer once the work is done.
    after(() => runCommand(interaction))
    return json({ type: 5, data: isPublic(interaction) ? {} : { flags: EPHEMERAL } })
  }

  return json({ type: 4, data: { content: "Unknown action.", flags: EPHEMERAL } })
}
