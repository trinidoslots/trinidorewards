"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  Chrome,
  Copy,
  Download,
  FolderOpen,
  KeyRound,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"
import manifest from "@/extension/manifest.json"
import { EXTENSION_CASINOS, EXTENSION_CHANGELOG, EXTENSION_PROVIDERS, type ChangelogEntry } from "@/lib/extension-info"

/**
 * The Hunt Tracker extension: what version is out, how to install or update
 * it, how it connects, what it supports, and what changed when.
 *
 * The version comes straight from extension/manifest.json, so it can never
 * disagree with the zip the download button builds. Everything else lives in
 * lib/extension-info.ts.
 */

const VERSION = manifest.version
const latest = EXTENSION_CHANGELOG[0]
const latestRelease = EXTENSION_CHANGELOG.find((e) => e.version === VERSION)

// Fixed zone: the times are when things went live for the stream, in
// Germany, whatever machine opens the page.
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
})

function formatAt(iso: string) {
  return dateFormat.format(new Date(iso))
}

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? "yesterday" : `${d} days ago`
}

/** Relative times only after mount: the server's clock and the browser's would disagree and break hydration. */
function useNow() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-[#7FA8F5]">{children}</code>
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="mt-1.5 flex w-full items-center gap-2 rounded border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-left font-mono text-[12px] text-white/80 hover:bg-white/[0.04]"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.green }} />
      ) : (
        <Copy className="ml-auto h-3.5 w-3.5 shrink-0 text-white/40" />
      )}
    </button>
  )
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Panel className="px-3.5 py-3">
      <MonoLabel className="text-white/35">{label}</MonoLabel>
      <div className="mt-2 text-[20px] font-semibold leading-none text-white tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-white/40">{sub}</div>}
    </Panel>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
        style={{ backgroundColor: `${ACCENTS.blue}1f`, color: ACCENTS.blue }}
      >
        {n}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[13px] font-medium text-white">{title}</p>
        <div className="mt-0.5 text-[13px] leading-relaxed text-white/50">{children}</div>
      </div>
    </li>
  )
}

function KindTag({ entry }: { entry: ChangelogEntry }) {
  const isExtension = entry.kind === "extension"
  const color = isExtension ? ACCENTS.blue : ACCENTS.purple
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {isExtension ? <Puzzle className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
      {isExtension ? (entry.version ? `v${entry.version}` : "Extension") : "Site"}
    </span>
  )
}

function Changelog({ now }: { now: number | null }) {
  return (
    <Panel>
      <PanelHeader
        title="Changelog"
        accent="blue"
        right={<MonoLabel className="text-white/30">{EXTENSION_CHANGELOG.length} entries</MonoLabel>}
      />
      <ol className="relative px-3.5 py-4">
        {/* Timeline rail */}
        <span className="absolute bottom-6 left-[21px] top-6 w-px bg-white/[0.08]" aria-hidden />
        {EXTENSION_CHANGELOG.map((entry, i) => {
          const isLatest = i === 0
          const color = entry.kind === "extension" ? ACCENTS.blue : ACCENTS.purple
          return (
            <li key={`${entry.at}-${entry.title}`} className="relative flex gap-3.5 pb-6 last:pb-0">
              <span
                className="relative z-[1] mt-1 h-3 w-3 shrink-0 rounded-full border-2"
                style={{
                  borderColor: color,
                  backgroundColor: isLatest ? color : "#0B0B0D",
                  boxShadow: isLatest ? `0 0 0 4px ${color}26` : undefined,
                }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <KindTag entry={entry} />
                  <span className="text-[14px] font-medium text-white">{entry.title}</span>
                  {isLatest && (
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                      style={{ color: ACCENTS.green, backgroundColor: `${ACCENTS.green}1a` }}
                    >
                      Latest
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-white/40">
                  <time dateTime={entry.at}>{formatAt(entry.at)}</time>
                  {now !== null && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{timeAgo(entry.at, now)}</span>
                    </>
                  )}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {entry.changes.map((change) => (
                    <li key={change} className="flex gap-2 text-[13px] leading-relaxed text-white/60">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-white/25" aria-hidden />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

export default function AdminExtensionPage() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = useNow()

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/extension/download")
      if (!response.ok) throw new Error("Could not build the extension package")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `trinidorewards-hunt-tracker-v${VERSION}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the extension")
    } finally {
      setDownloading(false)
    }
  }

  const verifiedProviders = EXTENSION_PROVIDERS.filter((p) => p.verified).length

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <MonoLabel className="flex items-center gap-1.5 text-[#5B8DEF]">
            <Puzzle className="h-3.5 w-3.5" /> Chrome extension
          </MonoLabel>
          <h1 className="mt-2 flex flex-wrap items-center gap-2.5 text-2xl font-semibold text-white">
            Hunt Tracker
            <span
              className="rounded-md px-2 py-0.5 font-mono text-[13px] font-medium"
              style={{ color: ACCENTS.blue, backgroundColor: `${ACCENTS.blue}1f` }}
            >
              v{VERSION}
            </span>
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/45">
            Adds bonuses to the active hunt straight from the casino — one click, or automatically the moment a bonus
            triggers — and keeps the now-playing bar on the game you are on.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#5B8DEF] px-4 py-2.5 text-[13px] font-semibold text-[#0B0B0D] transition-colors hover:bg-[#7FA8F5] disabled:opacity-60 sm:ml-auto"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : `Download v${VERSION}`}
        </button>
      </div>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Current version"
          value={`v${VERSION}`}
          sub={latestRelease ? `released ${formatAt(latestRelease.at)}` : undefined}
        />
        <Stat
          label="Last change"
          value={now !== null ? timeAgo(latest.at, now) : formatAt(latest.at).split(",")[0]}
          sub={latest.title}
        />
        <Stat label="Casinos" value={EXTENSION_CASINOS.length} sub="Stake inline, others docked" />
        <Stat
          label="Auto tracking"
          value={`${EXTENSION_PROVIDERS.length} providers`}
          sub={`${verifiedProviders} checked against a real game`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Install / update */}
        <Panel>
          <PanelHeader title="Install or update" accent="blue" right={<Chrome className="h-3.5 w-3.5 text-white/30" />} />
          <ol className="space-y-3.5 px-3.5 py-4">
            <Step n={1} title="Download and unzip">
              Use the button above and extract the .zip. To update, replace the files of the folder you loaded last
              time — same folder, so Chrome keeps the settings and API key.
            </Step>
            <Step n={2} title="Load it in Chrome">
              Open <Code>chrome://extensions</Code>, switch on Developer mode, then <b className="text-white/70">Load unpacked</b>{" "}
              and pick the folder. Updating: press the reload arrow on the extension card instead.
            </Step>
            <Step n={3} title="Approve site access">
              Chrome asks once for the casino and game-provider sites. Open casino tabs pick up the new version by
              themselves.
            </Step>
            <Step n={4} title="Connect">
              Click the extension icon → gear → <b className="text-white/70">Connection</b>, paste the{" "}
              <Code>EXTENSION_API_KEY</Code> and save. It should say &quot;Connected&quot;.
            </Step>
            <Step n={5} title="Pick what it does">
              In the same settings: casinos, auto tracking per provider (off by default), the on-page marks and the
              now-playing overlay.
            </Step>
          </ol>
        </Panel>

        <div className="space-y-4">
          {/* Connection */}
          <Panel>
            <PanelHeader title="Connection" accent="green" right={<KeyRound className="h-3.5 w-3.5 text-white/30" />} />
            <div className="space-y-3 px-3.5 py-4 text-[13px] leading-relaxed text-white/55">
              <p>
                Every request carries <Code>Authorization: Bearer &lt;EXTENSION_API_KEY&gt;</Code>. The key is kept in
                Chrome&apos;s local storage, never in the downloaded files.
              </p>
              <div>
                <MonoLabel className="text-white/35">Default site</MonoLabel>
                <CopyField value="https://trinidorewards.vercel.app" />
              </div>
              <div className="flex gap-2.5 rounded-md border border-white/[0.06] bg-black/20 p-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENTS.green }} />
                <p className="text-[12.5px]">
                  <Code>/api/extension/*</Code> is exempt from the Cloudflare origin lock, so the extension keeps
                  working on the vercel.app address while the lock is on. The key check in each route still applies.
                </p>
              </div>
            </div>
          </Panel>

          {/* What it supports */}
          <Panel>
            <PanelHeader title="Supported" accent="purple" right={<Sparkles className="h-3.5 w-3.5 text-white/30" />} />
            <div className="space-y-4 px-3.5 py-4">
              <div>
                <MonoLabel className="text-white/35">Casinos</MonoLabel>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXTENSION_CASINOS.map((casino) => (
                    <span
                      key={casino}
                      className="rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[12px] text-white/70"
                    >
                      {casino}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <MonoLabel className="text-white/35">Auto tracking</MonoLabel>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXTENSION_PROVIDERS.map((provider) => (
                    <span
                      key={provider.name}
                      className="flex items-center gap-1.5 rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[12px] text-white/70"
                      title={provider.verified ? "Checked against a real game" : "Built from the protocol, not yet confirmed on a real game"}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: provider.verified ? ACCENTS.green : ACCENTS.amber }}
                      />
                      {provider.name}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-white/35">
                  <span style={{ color: ACCENTS.green }}>●</span> checked on a real game ·{" "}
                  <span style={{ color: ACCENTS.amber }}>●</span> not confirmed yet
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Changelog now={now} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Troubleshooting" accent="amber" right={<RefreshCw className="h-3.5 w-3.5 text-white/30" />} />
          <ul className="space-y-2 px-3.5 py-4 text-[13px] leading-relaxed text-white/55">
            <li>
              <b className="text-white/75">Nothing happens on the casino page:</b> reload the tab once; check the casino
              is switched on in Settings → Casinos.
            </li>
            <li>
              <b className="text-white/75">Auto tracking silent:</b> open DevTools (F12) on the casino page. Each spin
              logs <Code>[Hunt Tracker] bet from …</Code>, a bonus <Code>bonus trigger from …</Code>. No lines means the
              game frame was not reached.
            </li>
            <li>
              <b className="text-white/75">&quot;API key rejected&quot;:</b> the key in Connection does not match{" "}
              <Code>EXTENSION_API_KEY</Code> in Vercel.
            </li>
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="API" accent="slate" right={<Terminal className="h-3.5 w-3.5 text-white/30" />} />
          <div className="space-y-2 px-3.5 py-4 text-[13px] leading-relaxed text-white/55">
            <p>
              <Code>/api/extension/add-bonus</Code> — GET active hunt and its bonuses, POST adds a bonus, DELETE removes
              one by id.
            </p>
            <p>
              <Code>/api/extension/now-playing</Code> — GET what is on the bar, POST sets it, DELETE clears it.
            </p>
            <p className="flex items-center gap-1.5 text-[12px] text-white/35">
              <FolderOpen className="h-3.5 w-3.5" /> Source: <Code>/extension</Code> in the repository.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
