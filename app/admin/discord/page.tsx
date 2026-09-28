"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Copy, RefreshCw, XCircle } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"

/**
 * The Discord bot's setup and health, in the order it has to be done.
 *
 * The bot itself is API routes (app/api/discord, app/api/kick/webhook); this
 * page only shows whether each piece is in place and runs the two one-time
 * calls that need the bot token — registering the slash commands and
 * subscribing to Kick's live events. Everything else happens in Discord with /setup.
 */

type Check = { ok: boolean; error?: string }
type Status = {
  env: Record<string, boolean>
  kickSlug: string
  interactionsUrl: string
  kickWebhookUrl: string
  inviteUrl?: string
  bot?: Check & { name?: string }
  state?: Check & { setUp?: boolean; live?: boolean }
  kick?: Check & { subscribed?: string[] }
}

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

export default function DiscordAdminPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch("/api/admin/discord", { cache: "no-store" })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json) setError(json?.error ?? "Could not load the bot status.")
    else setStatus(json)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: string) {
    setBusy(action)
    setNotice(null)
    const res = await fetch("/api/admin/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const json = await res.json().catch(() => ({}))
    setNotice({ ok: res.ok, text: json.message ?? json.error ?? (res.ok ? "Done." : "Failed.") })
    setBusy(null)
    load()
  }

  const envOk = status ? Object.values(status.env).every(Boolean) : false
  const subscribed = status?.kick?.subscribed ?? []
  const kickOk = subscribed.includes("livestream.status.updated")

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Discord bot</h1>
          <p className="text-[13px] text-white/40">
            Live pings from Kick, new raffles and leaderboards, winners — posted to Discord automatically.
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
          <Step n={1} done={envOk && status.bot?.ok} title="Environment variables on Vercel">
            <p>
              From the Discord developer portal (your application → General Information / Bot). Add them in Vercel →
              Settings → Environment Variables, then redeploy.
            </p>
            <ul className="space-y-1 pt-1">
              {Object.entries(status.env).map(([name, set]) => (
                <li key={name} className="flex items-center gap-2 font-mono text-[12px]">
                  <Mark ok={set} /> {name}
                </li>
              ))}
            </ul>
            {status.bot && (
              <p className="pt-1">
                {status.bot.ok ? `Token works — logged in as ${status.bot.name}.` : `Token check failed: ${status.bot.error}`}
              </p>
            )}
          </Step>

          <Step n={2} done={status.state?.ok} title="Database table (scripts/074_discord_state.sql)">
            <p>Paste the script into the Supabase SQL editor and run it.</p>
            {status.state && !status.state.ok && <p style={{ color: ACCENTS.red }}>{status.state.error}</p>}
          </Step>

          <Step n={3} title="Interactions Endpoint URL">
            <p>
              Discord developer portal → General Information → <b>Interactions Endpoint URL</b>. Discord checks it
              when you save; it only passes once steps 1 and 2 are live.
            </p>
            <CopyField value={status.interactionsUrl} />
          </Step>

          <Step n={4} title="Invite the bot and register the commands">
            {status.inviteUrl ? (
              <p>
                <a href={status.inviteUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: ACCENTS.blue }}>
                  Invite the bot to the server
                </a>
                , then in Discord drag the bot's role to the top of Server Settings → Roles.
              </p>
            ) : (
              <p>Needs step 1.</p>
            )}
            <button
              disabled={!envOk || busy !== null}
              onClick={() => run("register-commands")}
              className="mt-1 rounded bg-white/[0.08] px-3 py-1.5 text-[12px] text-white hover:bg-white/[0.12] disabled:opacity-40"
            >
              {busy === "register-commands" ? "Registering…" : "Register slash commands"}
            </button>
          </Step>

          <Step n={5} done={status.state?.setUp} title="Run /setup in Discord">
            <p>Creates the categories, channels, roles and panels. Safe to run again after changing anything.</p>
          </Step>

          <Step n={6} done={kickOk} title={`Kick live notifications (kick.com/${status.kickSlug})`}>
            <p>
              In the site's Kick app (kick.com → Settings → Developer → your app) switch <b>webhooks</b> on and set the
              webhook URL to:
            </p>
            <CopyField value={status.kickWebhookUrl} />
            <button
              disabled={busy !== null}
              onClick={() => run("subscribe-kick")}
              className="mt-1 rounded bg-white/[0.08] px-3 py-1.5 text-[12px] text-white hover:bg-white/[0.12] disabled:opacity-40"
            >
              {busy === "subscribe-kick" ? "Subscribing…" : "Subscribe to live events"}
            </button>
            {status.kick && !status.kick.ok && <p style={{ color: ACCENTS.red }}>{status.kick.error}</p>}
            {subscribed.length > 0 && <p>Subscribed: {subscribed.join(", ")}</p>}
            {status.state?.ok && <p>Bot thinks the stream is {status.state.live ? "🔴 live" : "⚫ offline"}.</p>}
          </Step>
        </>
      )}
    </div>
  )
}
