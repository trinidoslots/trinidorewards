import { discordConfig } from "@/lib/discord/config"

/**
 * A thin wrapper over Discord's REST API.
 *
 * The bot never holds a gateway connection — nothing on Vercel lives long
 * enough to — so every action it takes is one of these calls. discord.js is
 * not used: its Client is built around the gateway, and the parts that are
 * not come to a few lines of fetch.
 */

const API = "https://discord.com/api/v10"

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    message: string,
  ) {
    super(message)
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export async function discord<T = any>(
  method: Method,
  path: string,
  body?: unknown,
  options: { reason?: string; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.auth !== false) headers.Authorization = `Bot ${discordConfig().token}`
  if (body !== undefined) headers["Content-Type"] = "application/json"
  // Shows up in the server's audit log next to whatever the bot changed.
  if (options.reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(options.reason)

  // /setup makes a few dozen calls in a row and will hit the per-route limits.
  // Discord says how long to wait; waiting that long and trying again is the
  // documented way through.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    })

    if (res.status === 429 && attempt < 4) {
      const info = await res.json().catch(() => ({}))
      const wait = Math.min(10, Number(info?.retry_after) || 1)
      await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 100))
      continue
    }

    if (res.status === 204) return undefined as T
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new DiscordApiError(res.status, data?.code, describe(res.status, data?.code, data?.message))
    }
    return data as T
  }
}

// The two failures anyone setting this up will actually meet, in words they can act on.
function describe(status: number, code: number | undefined, message: string | undefined): string {
  if (code === 50013) return "Dem Bot fehlen Rechte (Rollen/Kanäle verwalten) oder seine Rolle steht zu weit unten."
  if (code === 50001) return "Der Bot hat keinen Zugriff auf diesen Kanal."
  if (status === 401) return "Discord hat den Bot-Token abgelehnt – DISCORD_BOT_TOKEN prüfen."
  return `Discord-API: ${message ?? "Fehler"} (HTTP ${status}${code ? `, Code ${code}` : ""})`
}
