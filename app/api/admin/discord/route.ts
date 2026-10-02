import { after } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { discordConfig, KICK_SLUG, SITE_URL } from "@/lib/discord/config"
import { discord } from "@/lib/discord/rest"
import { registerCommands } from "@/lib/discord/commands"
import { listSubscriptions, subscribeLiveEvents } from "@/lib/discord/kick"
import { getIds, getLive } from "@/lib/discord/state"
import { announceLeaderboardCreated, announceRaffleCreated } from "@/lib/discord/site"
import { botLeaderboardCreated, botRaffleCreated } from "@/lib/kick-bot/announce"

/**
 * The admin side of the Discord bot.
 *
 * GET  — status for /admin/discord: what is configured, what is set up.
 * POST — { action: "register-commands" | "subscribe-kick" }, the two one-time
 *        setup steps; or { action: "announce", kind: "raffle" | "leaderboard", id }
 *        which the admin forms call after creating one. The Kick bot posts the
 *        same news in chat from here (lib/kick-bot/announce.ts).
 */

export const dynamic = "force-dynamic"

const envNames = ["DISCORD_BOT_TOKEN", "DISCORD_APPLICATION_ID", "DISCORD_PUBLIC_KEY", "DISCORD_GUILD_ID"] as const

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const env = Object.fromEntries(envNames.map((name) => [name, Boolean(process.env[name])]))
  const result: Record<string, unknown> = {
    env,
    kickSlug: KICK_SLUG,
    interactionsUrl: `${SITE_URL}/api/discord/interactions`,
    kickWebhookUrl: `${SITE_URL}/api/kick/webhook`,
  }

  if (envNames.every((name) => process.env[name])) {
    const { applicationId } = discordConfig()
    result.inviteUrl = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot+applications.commands&permissions=268692496`
    result.bot = await discord<{ username: string }>("GET", "/users/@me")
      .then((me) => ({ ok: true, name: me.username }))
      .catch((e: Error) => ({ ok: false, error: e.message }))
  }

  result.state = await Promise.all([getIds(), getLive()])
    .then(([ids, live]) => ({ ok: true, setUp: Boolean(ids.channels.live), live: live.isLive }))
    .catch((e: Error) => ({ ok: false, error: e.message }))

  result.kick = await listSubscriptions()
    .then((subs) => ({ ok: true, subscribed: subs.map((s) => s.event) }))
    .catch((e: Error) => ({ ok: false, error: e.message }))

  return Response.json(result)
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}) as Record<string, unknown>)

  try {
    switch (body.action) {
      case "register-commands":
        return Response.json({ ok: true, message: `Registriert: ${(await registerCommands()).join(", ")}` })
      case "subscribe-kick":
        return Response.json({ ok: true, message: await subscribeLiveEvents() })
      case "announce": {
        const id = typeof body.id === "string" ? body.id : ""
        if (!id) return Response.json({ error: "id is required" }, { status: 400 })
        // After the response, so saving the form never waits on Discord.
        if (body.kind === "raffle") after(() => Promise.all([announceRaffleCreated(id), botRaffleCreated(id)]))
        else if (body.kind === "leaderboard") after(() => Promise.all([announceLeaderboardCreated(id), botLeaderboardCreated(id)]))
        else return Response.json({ error: "Unknown kind" }, { status: 400 })
        return Response.json({ ok: true })
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : "Failed"
    console.error("[admin/discord]", body.action, problem)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
