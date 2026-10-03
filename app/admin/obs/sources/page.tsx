"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { ArrowRight, Check, Copy, ExternalLink } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, type Accent } from "@/components/ui/panel"
import { CASINOS } from "@/components/obs/casino-themes"
import { adminHref } from "@/lib/admin-host"
import { CASINO_IDS, type CasinoId } from "@/lib/casinos"
import { siteHref, siteUrl } from "@/lib/site-url"

/**
 * Every OBS browser source in one place.
 *
 * They used to be spread over the panel — a few on the overview, the
 * tournament ones behind a button on Tournaments, the giveaway ones in a
 * popover, the casino frames on Now Playing. Those pages keep the links that
 * belong to them; this is the list of all of them, with the size each one is
 * laid out for and the page that controls what it shows.
 *
 * Nothing here is saved or fetched. Adding a source to the site means adding
 * it to SOURCE_GROUPS; a casino comes from lib/casinos.ts.
 */

type Source = {
  path: string
  label: string
  /** Width × height to give the browser source in OBS. */
  size: string
  about: string
  /** Query options worth knowing, as shown to the reader. */
  options?: string
  /** The admin page that decides what the source shows. */
  controlledAt?: { href: string; label: string }
}

const SOURCE_GROUPS: { title: string; accent: Accent; sources: Source[] }[] = [
  {
    title: "Full scenes",
    accent: "blue",
    sources: [
      {
        path: "/obs/complete",
        label: "Everything, one source",
        size: "1920×1080",
        about: "Top ticker, bonus hunt, stream column and the painted scene behind them, as one source.",
        options: "?hunt=0 or ?stream=0 drops a column · ?gap=1 leaves the middle empty for the game",
      },
      {
        path: "/obs/starting-soon",
        label: "Starting soon",
        size: "1920×1080",
        about: "The countdown scene. Same background as the combined overlay, so cutting between them does not jump.",
        options: "?preview=1",
        controlledAt: { href: "/admin/obs/starting-soon", label: "Starting Soon" },
      },
    ],
  },
  {
    title: "Stream overlays",
    accent: "amber",
    sources: [
      {
        path: "/obs/hunt",
        label: "Bonus hunt",
        size: "214×800",
        about: "The running hunt: bonuses, what has been opened, and the totals.",
        controlledAt: { href: "/admin/bonushunt", label: "Bonus Hunt" },
      },
      {
        path: "/obs/stream",
        label: "Stream column",
        size: "340×900",
        about: "Giveaway, live events and Kick chat in one narrow column. Fills whatever height it gets.",
        options: "?channel=<kick slug> · ?preview=1",
        controlledAt: { href: "/admin/giveaway", label: "Giveaway" },
      },
      {
        path: "/obs/giveaway",
        label: "Giveaway only",
        size: "300×120",
        about: "The giveaway card on its own.",
        controlledAt: { href: "/admin/giveaway", label: "Giveaway" },
      },
      {
        path: "/obs/top-bar",
        label: "Top ticker",
        size: "1920×50",
        about: "Timers and info lines across the top of the screen.",
        controlledAt: { href: "/admin/obs/widget-settings", label: "Widget Settings" },
      },
      {
        path: "/deposits-withdrawals",
        label: "Transactions",
        size: "340×140",
        about: "Deposits and cashouts with their totals.",
        controlledAt: { href: "/admin/settings", label: "Settings" },
      },
    ],
  },
  {
    title: "Casino strips",
    accent: "green",
    sources: [
      {
        path: "/obs/now-playing",
        label: "Now playing bar",
        size: "1410×40",
        about: "The game being played, as the casino's own info bar. Disappears when nothing is playing.",
        options: "?casino=<casino> · ?preview=1 · ?art=1 · ?x ?y ?w to place it on a full-canvas source",
        controlledAt: { href: "/admin/obs/now-playing", label: "Now Playing" },
      },
      {
        path: "/obs/casino-top",
        label: "Casino top strip",
        size: "1410×50",
        about: "The casino's header strip, for above the game capture. The casino frame below has both strips in one.",
        options: "?casino=<casino>",
      },
    ],
  },
  {
    title: "Tournaments",
    accent: "purple",
    sources: [
      {
        path: "/obs/tournament/overview",
        label: "Bracket",
        size: "Wide, any size",
        about: "Every round and every result. Follows the newest tournament.",
        options: "?id=<tournament id> · ?preview=1",
        controlledAt: { href: "/admin/tournaments", label: "Tournaments" },
      },
      {
        path: "/obs/tournament/round",
        label: "Current match",
        size: "Small, any size",
        about: "The match being opened right now, as one card.",
        options: "?id=<tournament id> · ?preview=1",
        controlledAt: { href: "/admin/tournaments", label: "Tournaments" },
      },
    ],
  },
]

/** The casino-frame size; the strips inside it are sized off this. */
const FRAME_SIZE = "1410×900"

/** Stake is what the strips show without a ?casino, so its links stay bare. */
function casinoQuery(casino: CasinoId) {
  return casino === "stake" ? "" : `?casino=${casino}`
}

export default function ObsSourcesPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied((current) => (current === url ? null : current)), 1500)
    } catch {
      // Clipboard can be blocked; the URL is on screen either way.
    }
  }

  // siteUrl falls back to this window's origin, which the server render does
  // not have. siteHref is the same on both sides, so the first paint uses that
  // and the full address arrives once mounted.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const urlLine = (path: string) => (
    <UrlLine url={mounted ? siteUrl(path) : siteHref(path)} copied={copied} onCopy={copy} />
  )

  return (
    <div className="space-y-4 pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">OBS sources</h1>
        <p className="mt-1 text-[13px] text-white/40">
          Every overlay on the site, with the size to give it in OBS and the page that controls it.
        </p>
      </header>

      <Panel accent="blue">
        <PanelHeader title="Adding a source in OBS" />
        <ol className="list-decimal space-y-2 py-3.5 pl-9 pr-4 text-[13px] leading-relaxed text-white/70 marker:text-white/30">
          <li>
            In the scene, under <strong className="text-white">Sources</strong>, click{" "}
            <strong className="text-white">+</strong> and pick <strong className="text-white">Browser</strong>. Name it
            after the source.
          </li>
          <li>
            Copy the URL below and paste it into <strong className="text-white">URL</strong>.
          </li>
          <li>
            Set <strong className="text-white">Width</strong> and <strong className="text-white">Height</strong> to the
            size next to the source. Leave the rest as it is — the page is already transparent.
          </li>
          <li>
            Click OK and move the source into place. Do not drag its edges to resize it: a stretched source looks
            blurry. To change the size, change Width and Height in its Properties, then right-click it and choose{" "}
            <strong className="text-white">Transform → Reset Transform</strong>.
          </li>
          <li>
            Showing old content after an update? Right-click the source and choose{" "}
            <strong className="text-white">Refresh</strong>.
          </li>
        </ol>
        <p className="border-t border-white/[0.06] px-4 py-2.5 text-[11.5px] text-white/35">
          Most sources take <code className="text-white/55">?preview=1</code> to show sample data, for lining them up
          off-stream without touching anything that is saved.
        </p>
      </Panel>

      <Panel>
        <PanelHeader title="Casinos" accent="green" />
        <div className="p-3.5">
          <p className="mb-3 text-[12px] leading-relaxed text-white/40">
            One casino frame per casino: the casino&apos;s header above the game capture, the now-playing bar below it,
            rails down the sides. Give the source {FRAME_SIZE}. The strips on their own are the same look, for placing
            separately.
          </p>
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {CASINO_IDS.map((casino) => {
              const theme = CASINOS[casino]
              return (
                <div key={casino} className="overflow-hidden rounded-md border border-white/[0.08]">
                  <div
                    className="flex h-12 items-center justify-between px-3.5"
                    style={{ backgroundColor: theme.colors.topBackground }}
                  >
                    <img src={theme.logo.src} alt={theme.name} className="h-6 w-auto max-w-[60%] object-contain" />
                    <MonoLabel className="text-white/50">{theme.name}</MonoLabel>
                  </div>
                  <div className="space-y-2.5 p-3">
                    <LinkBlock label="Casino frame" size={FRAME_SIZE}>
                      {urlLine(`/obs/casino-frame/${casino}`)}
                    </LinkBlock>
                    <LinkBlock label="Now playing bar" size="1410×40">
                      {urlLine(`/obs/now-playing${casinoQuery(casino)}`)}
                    </LinkBlock>
                    <LinkBlock label="Top strip" size="1410×50">
                      {urlLine(`/obs/casino-top${casinoQuery(casino)}`)}
                    </LinkBlock>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11.5px] text-white/35">
            The game shown in the bar is set on{" "}
            <Link href={adminHref("/admin/obs/now-playing")} className="text-white/60 underline underline-offset-2">
              Now Playing
            </Link>{" "}
            or with the extension, and is the same for every casino.
          </p>
        </div>
      </Panel>

      {SOURCE_GROUPS.map((group) => (
        <Panel key={group.title}>
          <PanelHeader title={group.title} accent={group.accent} />
          <ul className="divide-y divide-white/[0.06]">
            {group.sources.map((source) => (
              <li key={source.path} className="space-y-2 px-3.5 py-3">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2.5">
                      <span className="text-[13px] font-medium text-white/90">{source.label}</span>
                      <MonoLabel className="text-white/35">{source.size}</MonoLabel>
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/40">{source.about}</p>
                    {source.options && <p className="mt-1 font-mono text-[10.5px] text-white/30">{source.options}</p>}
                  </div>
                  {source.controlledAt && (
                    <Link
                      href={adminHref(source.controlledAt.href)}
                      className="flex shrink-0 items-center gap-1 text-[11.5px] text-white/40 transition hover:text-white"
                    >
                      {source.controlledAt.label}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                {urlLine(source.path)}
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  )
}

function LinkBlock({ label, size, children }: { label: string; size: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-white/70">{label}</span>
        <MonoLabel className="text-white/30">{size}</MonoLabel>
      </p>
      {children}
    </div>
  )
}

/** The absolute URL, because OBS needs the full address, with copy and open. */
function UrlLine({ url, copied, onCopy }: { url: string; copied: string | null; onCopy: (url: string) => void }) {
  const isCopied = copied === url

  return (
    <div className="flex items-center gap-1.5">
      <code className="min-w-0 flex-1 truncate rounded-md border border-white/[0.08] bg-black/40 px-2.5 py-1.5 text-[11.5px] text-white/65">
        {url}
      </code>
      <button
        type="button"
        onClick={() => onCopy(url)}
        aria-label={`Copy ${url}`}
        className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 text-[11.5px] text-white/55 transition hover:border-white/25 hover:text-white"
      >
        {isCopied ? (
          <Check className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {isCopied ? "Copied" : "Copy"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${url}`}
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-white/[0.10] text-white/45 transition hover:border-white/25 hover:text-white"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
