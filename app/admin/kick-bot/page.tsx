"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Copy, RefreshCw, Send, XCircle } from "lucide-react"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"

/**
 * The Kick bot: @TrinidoRewards in the channel's chat.
 *
 * Setup in the order it has to happen, then what the bot says on its own,
 * a box to say something by hand, and the chat it has heard. The bot itself
 * is lib/kick-bot (announcements, !prediction) behind /api/kick/webhook.
 */

type Status = {
  app: { configured: boolean; ownApp: boolean }
  redirectUri: string
  webhookUrl: string
  channelSlug: string
  connection: { connected: boolean; username: string | null; scope: string | null; connectedAt: string | null } | null
  events: { list: { id: string; label: string }[]; enabled: Record<string, boolean> }
  chat?: { ok: boolean; subscribed?: boolean; error?: string }
  messages: { ok: boolean; error?: string; last24h?: number; recent?: ChatRow[] }
}

type ChatRow = { message_id: string; username: string; content: string; is_mod: boolean; sent_at: string }

function Mark({ ok }: { ok: boolean | undefined }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: ACCENTS.green }} />
  ) : (
    <XCircle className="h-4 w-4 shrink-0" style={{ color: ACCENTS.red }} />
  )
}

function CopyField({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value)}
      className="mt-1.5 flex w-full items-center gap-2 rounded border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-left font-mono text-[12px] text-white/80 hover:bg-white/[0.04]"
    >
      <span className="truncate">{value}</span>
      <Copy className="ml-auto h-3.5 w-3.5 shrink-0 text-white/40" />
    </button>
  )
}

function Step({ n, done, title, children }: { n: number; done?: boolean; title: string; children: React.ReactNode }) {
  return (
    <Panel accent={done ? "green" : "slate"} className="p-3.5">
      <div className="flex items-center gap-2">
        <MonoLabel className="text-white/40">Step {n}</MonoLabel>
        <span className="text-[14px] font-medium text-white">{title}</span>
        <span className="ml-auto">
          <Mark ok={done} />
        </span>
      </div>
      <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-white/60">{children}</div>
    </Panel>
  )
}

const buttonClass =
  "rounded bg-white/[0.08] px-3 py-1.5 text-[12px] text-white hover:bg-white/[0.12] disabled:opacity-40 disabled:hover:bg-white/[0.08]"

export default function KickBotAdminPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [draft, setDraft] = useState("")

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch("/api/admin/kick-bot", { cache: "no-store" })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json) setError(json?.error ?? "Could not load the bot status.")
    else setStatus(json)
  }, [])

  useEffect(() => {
    load()
    // The outcome of the Kick sign-in comes back in the query string.
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get("bot")
    if (outcome) {
      setNotice(
        outcome === "connected"
          ? { ok: true, text: "Bot connected." }
          : outcome === "unconfigured"
            ? { ok: false, text: "No Kick app is configured yet – see step 1." }
            : { ok: false, text: params.get("detail") ?? "Could not connect the bot." },
      )
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [load])

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setNotice(null)
    const res = await fetch("/api/admin/kick-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    })
    const json = await res.json().catch(() => ({}))
    setNotice({ ok: res.ok, text: json.message ?? json.error ?? (res.ok ? "Done." : "Failed.") })
    setBusy(null)
    if (res.ok && action === "send") setDraft("")
    load()
    return res.ok
  }

  function toggle(id: string) {
    if (!status) return
    const enabled = { ...status.events.enabled, [id]: !status.events.enabled[id] }
    setStatus({ ...status, events: { ...status.events, enabled } })
    run("events", { events: enabled })
  }

  const connection = status?.connection
  const connected = Boolean(connection?.connected)
  const wrongChannel =
    connected && connection?.username && connection.username.toLowerCase() !== status?.channelSlug.toLowerCase()
  const subscribed = Boolean(status?.chat?.subscribed)

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Kick bot</h1>
          <p className="text-[13px] text-white/40">
            @TrinidoRewards in chat: raffles, tournaments, points and predictions announced automatically, !prediction
            answered.
          </p>
        </div>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}
      {notice && (
        <Panel
          accent={notice.ok ? "green" : "red"}
          className="px-3.5 py-2.5 text-[13px]"
          style={{ color: notice.ok ? ACCENTS.green : ACCENTS.red }}
        >
          {notice.text}
        </Panel>
      )}

      {status && (
        <>
          <Step n={1} done={status.app.configured} title="Kick app">
            {status.app.ownApp ? (
              <p>Using the bot's own app (KICK_BOT_CLIENT_ID / KICK_BOT_CLIENT_SECRET).</p>
            ) : status.app.configured ? (
              <p>
                Using the site's login app. If the bot has its own Kick app, add <b>KICK_BOT_CLIENT_ID</b> and{" "}
                <b>KICK_BOT_CLIENT_SECRET</b> in Vercel → Settings → Environment Variables and redeploy.
              </p>
            ) : (
              <p>
                Add <b>KICK_BOT_CLIENT_ID</b> and <b>KICK_BOT_CLIENT_SECRET</b> in Vercel → Settings → Environment
                Variables, then redeploy.
              </p>
            )}
            <p className="pt-1">In that app on kick.com (Settings → Developer), add this Redirect URL:</p>
            <CopyField value={status.redirectUri} />
            <p className="pt-1">
              switch <b>Webhooks</b> on and set the Webhook URL to:
            </p>
            <CopyField value={status.webhookUrl} />
          </Step>

          <Step n={2} done={status.messages.ok} title="Database table (scripts/088_kick_bot_chat.sql)">
            <p>Paste the script into the Supabase SQL editor and run it.</p>
            {!status.messages.ok && <p style={{ color: ACCENTS.red }}>{status.messages.error}</p>}
          </Step>

          <Step n={3} done={connected && !wrongChannel} title="Connect with the streamer account">
            <p>
              Sign in on Kick as <b>{status.channelSlug}</b> (not as the bot): Kick posts the bot's messages in the
              channel of whoever connects it.
            </p>
            {connected ? (
              <p>
                Connected to <b>{connection?.username ?? "unknown"}</b>
                {connection?.connectedAt ? ` since ${new Date(connection.connectedAt).toLocaleString()}` : ""}.
              </p>
            ) : null}
            {wrongChannel && (
              <p style={{ color: ACCENTS.red }}>
                That is not {status.channelSlug}. Disconnect, sign out of Kick, and connect again with the streamer
                account.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="/api/admin/kick-bot/connect"
                aria-disabled={!status.app.configured}
                className={`${buttonClass} ${status.app.configured ? "" : "pointer-events-none opacity-40"}`}
              >
                {connected ? "Connect again" : "Connect with Kick"}
              </a>
              {connected && (
                <button disabled={busy !== null} onClick={() => run("disconnect")} className={buttonClass}>
                  Disconnect
                </button>
              )}
            </div>
          </Step>

          <Step n={4} done={subscribed} title="Listen to chat">
            <p>Has Kick send every chat message to the webhook from step 1. The bot keeps them for 7 days.</p>
            <button
              disabled={!connected || busy !== null}
              onClick={() => run("subscribe-chat")}
              className={buttonClass}
            >
              {busy === "subscribe-chat" ? "Subscribing…" : subscribed ? "Subscribed" : "Subscribe to chat"}
            </button>
            {status.chat && !status.chat.ok && <p style={{ color: ACCENTS.red }}>{status.chat.error}</p>}
          </Step>

          <Panel className="p-3.5">
            <div className="text-[14px] font-medium text-white">Announcements</div>
            <p className="mt-1 text-[13px] text-white/50">What the bot posts in chat on its own. Each is posted once.</p>
            <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
              {status.events.list.map((event) => (
                <label
                  key={event.id}
                  className="flex cursor-pointer items-center gap-2 rounded border border-white/[0.06] px-2.5 py-1.5 text-[13px] text-white/80 hover:bg-white/[0.03]"
                >
                  <input
                    type="checkbox"
                    checked={status.events.enabled[event.id] !== false}
                    onChange={() => toggle(event.id)}
                    disabled={busy === "events"}
                    className="accent-[#53fc18]"
                  />
                  {event.label}
                </label>
              ))}
            </div>
          </Panel>

          <Panel className="p-3.5">
            <div className="text-[14px] font-medium text-white">Write in chat</div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (draft.trim()) run("send", { content: draft })
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={500}
                placeholder={connected ? "Message as @TrinidoRewards" : "Connect the bot first"}
                disabled={!connected}
                className="h-9 min-w-0 flex-1 rounded border border-white/[0.08] bg-black/30 px-2.5 text-[13px] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!connected || !draft.trim() || busy !== null}
                className={`${buttonClass} flex items-center gap-1.5`}
              >
                <Send className="h-3.5 w-3.5" /> {busy === "send" ? "Sending…" : "Send"}
              </button>
            </form>
          </Panel>

          <Panel className="p-3.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] font-medium text-white">Chat</span>
              {status.messages.ok && (
                <span className="text-[12px] text-white/40">{status.messages.last24h ?? 0} messages in the last 24h</span>
              )}
            </div>
            {status.messages.ok && (status.messages.recent?.length ?? 0) === 0 ? (
              <p className="mt-2 text-[13px] text-white/40">Nothing yet. Messages show up here once step 4 is done.</p>
            ) : (
              <ul className="mt-2 max-h-[420px] space-y-1 overflow-y-auto pr-1">
                {(status.messages.recent ?? []).map((row) => (
                  <li key={row.message_id} className="flex gap-2 text-[13px] leading-snug">
                    <span className="shrink-0 font-mono text-[11px] leading-5 text-white/30">
                      {new Date(row.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="min-w-0 break-words text-white/70">
                      <b style={{ color: row.is_mod ? ACCENTS.green : "rgba(255,255,255,0.9)" }}>{row.username}</b>{" "}
                      {row.content}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
