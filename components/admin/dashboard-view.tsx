"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Gift,
  LayoutGrid,
  PlayCircle,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile } from "@/components/ui/panel"
import { formatMoney, formatTransactionTime } from "@/lib/transactions"
import {
  periodProgress,
  timeLeft,
  type DashboardPayload,
  type HuntSummary,
  type LeaderboardSummary,
} from "@/lib/admin-dashboard"

/**
 * The four places this panel gets opened for, and two more that earn their
 * place by being where a queue item sends you.
 *
 * Deliberately not a copy of the sidebar. The sidebar lists everything; this
 * lists what gets used during a stream, which is a much shorter list and a
 * different one — "Opening mode" is a sub-page two levels down that gets
 * opened more often than most of the top-level sections.
 */
const QUICK_LINKS = [
  { href: "/admin/giveaway", icon: Gift, label: "Giveaway", copy: "Open entries, roll a winner" },
  { href: "/admin/bonushunt/opening", icon: PlayCircle, label: "Opening mode", copy: "Run the hunt live" },
  { href: "/admin/settings", icon: Wallet, label: "Transactions", copy: "Deposits, cashouts, totals" },
  { href: "/admin/modules", icon: LayoutGrid, label: "Modules", copy: "Turn sections on and off" },
  { href: "/admin/store/redemptions", icon: ShoppingBag, label: "Redemptions", copy: "Fulfil store orders" },
  { href: "/admin/users", icon: Users, label: "Users", copy: "Points, roles, usernames" },
]

const OBS_SOURCES = [
  { path: "/obs/hunt", label: "Bonus hunt", size: "214×800" },
  { path: "/obs/stream", label: "Stream column", size: "340×900" },
  { path: "/obs/giveaway", label: "Giveaway only", size: "300×120" },
  { path: "/deposits-withdrawals", label: "Transactions", size: "340×140" },
  { path: "/obs/top-bar", label: "Top ticker", size: "1920×50" },
  { path: "/obs/complete", label: "Everything, one source", size: "1920×1080" },
]

/**
 * The overview, given its data.
 *
 * Split from the page so what is on screen does not depend on being signed in
 * to look at: the page fetches, this renders what it is handed.
 *
 * Nothing below this point can see a half-loaded state. The first version
 * carried `data` and a `loading` flag through the whole tree and reached for
 * `data!` wherever loading was false — which crashes on the one path that
 * matters, a failed request, where loading is false and there is no data. The
 * panels are in `Loaded`, which is only rendered with a payload in hand.
 */
export function DashboardView({ data, error }: { data: DashboardPayload | null; error: string | null }) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="mt-1 text-[13px] text-white/40">Where the numbers stand and what to open next.</p>
      </header>

      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-[13px]"
          style={{ borderColor: `${ACCENTS.red}55`, backgroundColor: `${ACCENTS.red}12`, color: "#F3C9C9" }}
        >
          {error}
        </div>
      )}

      {data ? <Loaded data={data} /> : !error ? <LoadingLine /> : null}
    </div>
  )
}

function Loaded({ data }: { data: DashboardPayload }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Users registered"
          value={data.users.total.toLocaleString()}
          hint={`${data.users.recent.toLocaleString()} in the last 30 days`}
        />
        <StatTile
          label="Given away"
          accent="purple"
          value={data.givenAway === null ? "—" : formatMoney(data.givenAway)}
          hint="All time"
        />
        <StatTile
          label="Store redemptions"
          accent="amber"
          value={data.redemptions.total.toLocaleString()}
          hint={`${data.redemptions.pending} awaiting fulfilment`}
        />
        <StatTile
          label="Wins logged"
          accent="green"
          value={data.wins.total.toLocaleString()}
          hint={`${data.wins.pending} awaiting payout`}
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-3">
        <div className="space-y-2.5">
          <HuntPanel hunt={data.hunt} />

          <Panel>
            <PanelHeader title="Quick access" accent="blue" />
            {/*
              A one-pixel gap over a light background, so the tiles are
              separated by the same hairline the panels use rather than by a
              gutter of page showing through.
            */}
            <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
              {QUICK_LINKS.map(({ href, icon: Icon, label, copy }) => (
                <Link key={href} href={href} className="group bg-[#0E0E11] px-3 py-3 transition hover:bg-white/[0.05]">
                  <Icon className="h-4 w-4 text-white/35 transition group-hover:text-white/70" />
                  <p className="mt-2 text-[12.5px] font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/35">{copy}</p>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="Active leaderboards"
            accent="purple"
            right={<PanelLink href="/admin/leaderboards">Manage</PanelLink>}
          />
          {data.leaderboards.length === 0 ? (
            <EmptyLine>No leaderboard is running.</EmptyLine>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {data.leaderboards.map((board) => (
                <LeaderboardRow key={board.id} board={board} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Needs action" accent="red" />
          <ul className="divide-y divide-white/[0.06]">
            <QueueRow
              label="Store redemptions"
              count={data.queue.redemptions}
              href="/admin/store/redemptions"
              accent="amber"
            />
            <QueueRow label="Winners to pay" count={data.queue.wins} href="/admin/wins" accent="green" />
            <QueueRow label="Raffles to draw" count={data.queue.raffles} href="/admin/raffles/draw" accent="blue" />
            <QueueRow
              label="Leaderboards past their end"
              count={data.queue.leaderboards}
              href="/admin/leaderboards"
              accent="purple"
            />
          </ul>
        </Panel>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader
            title="Recent transactions"
            accent="green"
            right={<PanelLink href="/admin/settings">Manage</PanelLink>}
          />
          <LedgerTotals totals={data.ledger.totals} />
          {data.ledger.recent.length === 0 ? (
            <EmptyLine>Nothing yet. Add a deposit or cashout in Settings.</EmptyLine>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {data.ledger.recent.map((transaction) => {
                const isDeposit = transaction.kind === "deposit"
                const color = isDeposit ? ACCENTS.red : ACCENTS.green
                return (
                  <li key={transaction.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                      style={{ color, backgroundColor: `${color}1a` }}
                    >
                      {isDeposit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </span>
                    <span className="w-24 shrink-0 text-[13px] font-semibold tabular-nums" style={{ color }}>
                      {isDeposit ? "−" : "+"}
                      {formatMoney(Number(transaction.amount))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-white/40">{transaction.note ?? ""}</span>
                    <time className="shrink-0 font-mono text-[10px] tabular-nums text-white/25">
                      {formatTransactionTime(transaction.created_at)}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="OBS sources" accent="amber" />
          <ul className="divide-y divide-white/[0.06]">
            {OBS_SOURCES.map((source) => (
              <ObsSourceRow key={source.path} {...source} />
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

/**
 * The hunt that is on, at the top of the first column.
 *
 * The one thing on this page about right now rather than about a standing
 * total, so it gets a progress bar: "14 / 46" is the question being asked
 * while a hunt runs.
 */
function HuntPanel({ hunt }: { hunt: HuntSummary | null }) {
  const progress = hunt && hunt.total > 0 ? (hunt.opened / hunt.total) * 100 : 0

  return (
    <Panel>
      <PanelHeader title="Current hunt" accent="blue" right={<PanelLink href="/admin/bonushunt">Manage</PanelLink>} />
      {!hunt ? (
        <EmptyLine>No hunt running.</EmptyLine>
      ) : (
        <div className="space-y-3 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] font-semibold text-white">
              {/* A # only when the name is a bare number, as the overlay does. */}
              {hunt.title ? `Bonus Hunt ${/^\d+$/.test(hunt.title) ? "#" : ""}${hunt.title}` : "Bonus Hunt"}
            </p>
            <MonoLabel className={hunt.isOpening ? "text-white/70" : "text-white/25"}>
              {hunt.isOpening ? "Opening" : "Collecting"}
            </MonoLabel>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] text-white/35">Bonuses open</span>
            <span className="text-[13px] font-semibold tabular-nums text-white">
              {hunt.opened} / {hunt.total}
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, backgroundColor: ACCENTS.blue }}
            />
          </div>
        </div>
      )}
    </Panel>
  )
}

/**
 * The current time, but only once the component is running in a browser.
 *
 * "How far through its period" and "how long is left" are both read off the
 * clock, and the clock is different on the server than it is in the browser a
 * moment later. React compares the two renders attribute by attribute, so a
 * bar rendered server-side at 68.7026% against a client that computes
 * 68.70229% is a hydration mismatch — which is exactly what this did.
 *
 * Null until mounted, and the row draws an empty bar for that one frame. The
 * live page never sees it: its data arrives from a fetch, so there is nothing
 * to render until well after mount. It is the server-rendered case this
 * protects, which is the one that would otherwise break silently later.
 */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    // A minute is plenty: this drives a "4d 19h" readout and a bar whose whole
    // travel is measured in days.
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  return now
}

/** One leaderboard, with how far through its period it is. */
function LeaderboardRow({ board }: { board: LeaderboardSummary }) {
  const now = useNow()
  const progress = now === null ? 0 : periodProgress(board.start_date, board.end_date, now)

  return (
    <li className="space-y-2 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[12.5px] font-semibold text-white">{board.title}</p>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: ACCENTS.purple }}>
          {formatMoney(Number(board.prize_pool) || 0)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[11px] text-white/30">{board.subtitle ?? ""}</span>
        <MonoLabel className="shrink-0 text-white/40">
          {now === null ? "—" : timeLeft(new Date(board.end_date).getTime() - now)}
        </MonoLabel>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-700"
          style={{ width: `${progress}%`, backgroundColor: ACCENTS.purple }}
        />
      </div>
    </li>
  )
}

/**
 * A count that means somebody has to go and do something, and where to do it.
 *
 * A zero is drawn plainly and anything else in its accent, so the panel can be
 * read for whether there is work outstanding without reading a single label.
 */
function QueueRow({
  label,
  count,
  href,
  accent,
}: {
  label: string
  count: number
  href: string
  accent: keyof typeof ACCENTS
}) {
  const waiting = count > 0

  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-white/[0.04]">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: waiting ? ACCENTS[accent] : "rgba(255,255,255,0.15)" }}
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/70">{label}</span>
        <span
          className="shrink-0 text-[13px] font-semibold tabular-nums"
          style={{ color: waiting ? ACCENTS[accent] : "rgba(255,255,255,0.25)" }}
        >
          {count}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-white/0 transition group-hover:text-white/40" />
      </Link>
    </li>
  )
}

function LedgerTotals({ totals }: { totals: DashboardPayload["ledger"]["totals"] }) {
  const net = totals.net

  return (
    // Three across only once there is room. `$164,108.99` in tabular figures
    // does not wrap, so three of them set the grid's minimum width and the
    // panel was pushing past the page on a narrow screen.
    <div className="grid grid-cols-1 divide-y divide-white/[0.06] border-b border-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <LedgerTotal label="Deposited" value={formatMoney(totals.deposited)} color={ACCENTS.red} />
      <LedgerTotal label="Cashed out" value={formatMoney(totals.cashedOut)} color={ACCENTS.green} />
      <LedgerTotal
        label="Net"
        value={net === 0 ? "–" : `${net > 0 ? "+" : "−"}${formatMoney(Math.abs(net))}`}
        color={net > 0 ? ACCENTS.green : net < 0 ? ACCENTS.red : "rgba(255,255,255,0.5)"}
      />
    </div>
  )
}

function LedgerTotal({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-3.5 py-2.5">
      <MonoLabel className="text-white/25">{label}</MonoLabel>
      <p className="mt-1 text-[15px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/35 transition hover:text-white/80"
    >
      {children}
    </Link>
  )
}

function LoadingLine() {
  return <p className="py-8 text-center font-mono text-[11px] uppercase tracking-widest text-white/25">Loading</p>
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-[12px] text-white/30">{children}</p>
}

/** Copies the absolute URL, because OBS needs the full address, not the path. */
function ObsSourceRow({ path, label, size }: { path: string; label: string; size: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; the path is on screen either way.
    }
  }

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] text-white/80">{label}</p>
        <p className="truncate font-mono text-[10px] text-white/25">{path}</p>
      </div>
      <MonoLabel className="shrink-0 text-white/25">{size}</MonoLabel>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label} URL`}
        className="shrink-0 rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white/80"
      >
        {copied ? <Check className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </li>
  )
}
