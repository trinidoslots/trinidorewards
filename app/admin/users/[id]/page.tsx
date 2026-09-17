"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CreditCard,
  Eye,
  EyeOff,
  Link2,
  Package,
  Ticket,
  Trophy,
  UserRound,
} from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { sourceMeta, winValue, type WinLog } from "@/lib/wins"
import { CopyableId } from "@/components/ui/copyable-id"

/**
 * One user, everything about them.
 *
 * Every field comes from /api/admin/users/[id] rather than the browser client:
 * payout details live behind RLS with no policy, so the anon key cannot read
 * them at all and the route is the only way in.
 */

type Account = { id: string; site_name: string; username: string; created_at: string }
type Payment = { id: string; method: string; label: string | null; value: string; is_primary: boolean }
type Redemption = { id: string; item_name: string; cost: number; status: string; created_at: string }
type RaffleEntry = {
  id: string
  tickets_purchased: number
  points_spent: number
  created_at: string
  raffle: { title: string; prize_name: string; status: string } | null
}

type Payload = {
  user: {
    id: string
    username: string
    kick_id: string | null
    avatar_url: string | null
    points_balance: number
    created_at: string
  }
  accounts: Account[]
  payments: Payment[]
  redemptions: Redemption[]
  raffleEntries: RaffleEntry[]
  wins: WinLog[]
  totals: {
    points: number
    spentOnStore: number
    spentOnRaffles: number
    spentTotal: number
    redemptions: number
    rafflesEntered: number
    tickets: number
    wins: number
    wonCash: number
  }
}

const TABS = ["overview", "wins", "redemptions", "raffles"] as const
type Tab = (typeof TABS)[number]

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

function statusAccent(status: string) {
  if (status === "approved" || status === "completed" || status === "drawn") return "green" as const
  if (status === "rejected" || status === "cancelled") return "red" as const
  if (status === "active") return "blue" as const
  return "amber" as const
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const userId = params.id as string

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("overview")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Could not load that user")
      setData(payload as Payload)
      setError(null)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load that user")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <Panel className="py-16 text-center">
        <MonoLabel className="text-white/25">Loading</MonoLabel>
      </Panel>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Panel accent="red" className="px-4 py-3 text-[13px]" style={{ color: ACCENTS.red }}>
          {error ?? "Could not load that user"}
        </Panel>
      </div>
    )
  }

  const { user, accounts, payments, redemptions, raffleEntries, wins, totals } = data

  return (
    <div className="space-y-4">
      <BackLink />

      <Panel accent="blue" className="flex flex-wrap items-center gap-4 p-4">
        <Avatar url={user.avatar_url} username={user.username} />

        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white">{user.username}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <IdLine label="User ID" value={user.id} />
            <IdLine label="Kick ID" value={user.kick_id} />
          </div>
          <p className="mt-1.5 text-[12px] text-white/30">Joined {when(user.created_at)}</p>
        </div>
      </Panel>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Points balance" value={points(totals.points)} accent="green" />
        <StatTile label="Spent in store" value={points(totals.spentOnStore)} accent="amber" hint={`${totals.redemptions} redemptions`} />
        <StatTile label="Spent on raffles" value={points(totals.spentOnRaffles)} accent="purple" hint={`${totals.tickets} tickets`} />
        <StatTile
          label="Won"
          value={totals.wonCash > 0 ? `${Math.round(totals.wonCash).toLocaleString("en-US")}` : String(totals.wins)}
          accent="purple"
          hint={`${totals.wins} ${totals.wins === 1 ? "win" : "wins"} logged`}
        />
      </div>

      <nav className="flex gap-1 border-b border-white/[0.08]">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className="-mb-px border-b-2 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition"
            style={
              tab === name
                ? { borderColor: ACCENTS.blue, color: "#FFFFFF" }
                : { borderColor: "transparent", color: "rgba(255,255,255,0.35)" }
            }
          >
            {name}
            {name === "redemptions" && redemptions.length > 0 && (
              <span className="ml-1.5 text-white/25">{redemptions.length}</span>
            )}
            {name === "wins" && wins.length > 0 && <span className="ml-1.5 text-white/25">{wins.length}</span>}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <AccountsPanel accounts={accounts} />
          <PaymentsPanel payments={payments} />
        </div>
      )}

      {tab === "wins" && <WinsPanel wins={wins} />}
      {tab === "redemptions" && <RedemptionsPanel redemptions={redemptions} spent={totals.spentOnStore} />}
      {tab === "raffles" && <RafflesPanel entries={raffleEntries} spent={totals.spentOnRaffles} />}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/admin/users"
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 transition hover:text-white"
    >
      <ArrowLeft className="h-3 w-3" />
      All users
    </Link>
  )
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (!url) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
        <UserRound className="h-7 w-7 text-white/20" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      className="h-16 w-16 shrink-0 rounded-lg border border-white/[0.08] object-cover"
      // A Kick avatar URL can rot; falling back beats a broken-image glyph.
      onError={(event) => {
        event.currentTarget.style.display = "none"
      }}
      title={username}
    />
  )
}

function IdLine({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="flex items-center gap-1.5">
      <MonoLabel className="text-white/25">{label}</MonoLabel>
      <CopyableId value={value} chars={6} />
    </span>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12">
      {icon}
      <p className="text-[13px] text-white/30">{text}</p>
    </div>
  )
}

function AccountsPanel({ accounts }: { accounts: Account[] }) {
  return (
    <Panel accent="blue">
      <PanelHeader
        title="Connected accounts"
        right={<MonoLabel className="text-white/25">{accounts.length}</MonoLabel>}
      />
      {accounts.length === 0 ? (
        <Empty icon={<Link2 className="h-7 w-7 text-white/10" />} text="No accounts connected." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">{account.username}</p>
                <MonoLabel className="text-white/30">{account.site_name}</MonoLabel>
              </div>
              <CopyableId value={account.username} chars={20} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function PaymentsPanel({ payments }: { payments: Payment[] }) {
  // Hidden until asked for. This panel gets opened while a stream is live, and
  // a PayPal address or a wallet on screen is not recoverable afterwards.
  const [shown, setShown] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setShown((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Panel accent="green">
      <PanelHeader
        title="Payment methods"
        accent="green"
        right={<MonoLabel className="text-white/25">{payments.length}</MonoLabel>}
      />
      {payments.length === 0 ? (
        <Empty icon={<CreditCard className="h-7 w-7 text-white/10" />} text="No payout details saved." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {payments.map((payment) => {
            const visible = shown.has(payment.id)
            return (
              <li key={payment.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <MonoLabel style={{ color: ACCENTS.green }}>{payment.method}</MonoLabel>
                    {payment.label && <span className="text-[11px] text-white/30">{payment.label}</span>}
                    {payment.is_primary && <Tag accent="blue">Primary</Tag>}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[12px] text-white/70">
                    {visible ? payment.value : "•".repeat(Math.min(24, Math.max(8, payment.value.length)))}
                  </p>
                </div>
                {visible && <CopyableId value={payment.value} chars={6} />}
                <button
                  type="button"
                  onClick={() => toggle(payment.id)}
                  aria-label={visible ? "Hide value" : "Reveal value"}
                  className="shrink-0 rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                >
                  {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="border-t border-white/[0.05] px-3.5 py-2 text-[11px] text-white/25">
        Hidden by default — these are safe to open on stream.
      </p>
    </Panel>
  )
}

function RedemptionsPanel({ redemptions, spent }: { redemptions: Redemption[]; spent: number }) {
  return (
    <Panel accent="amber">
      <PanelHeader
        title="Store redemptions"
        accent="amber"
        // The figure the API worked out, not a fresh sum of the rows: the list
        // shows rejected redemptions too, and adding those in would contradict
        // the tile above by counting points that were refunded.
        right={<MonoLabel className="text-white/25">{points(spent)} points spent</MonoLabel>}
      />
      {redemptions.length === 0 ? (
        <Empty icon={<Package className="h-7 w-7 text-white/10" />} text="Nothing redeemed yet." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {redemptions.map((redemption) => (
            <li key={redemption.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
              <Package className="h-3.5 w-3.5 shrink-0 text-white/15" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-white">{redemption.item_name}</span>
              <Tag accent={statusAccent(redemption.status)}>{redemption.status}</Tag>
              <span className="w-20 shrink-0 text-right text-[13px] tabular-nums" style={{ color: ACCENTS.amber }}>
                {points(redemption.cost)}
              </span>
              <MonoLabel className="w-36 shrink-0 text-right text-white/20">{when(redemption.created_at)}</MonoLabel>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function RafflesPanel({ entries, spent }: { entries: RaffleEntry[]; spent: number }) {
  return (
    <Panel accent="purple">
      <PanelHeader
        title="Raffle entries"
        accent="purple"
        right={<MonoLabel className="text-white/25">{points(spent)} points spent</MonoLabel>}
      />
      {entries.length === 0 ? (
        <Empty icon={<Ticket className="h-7 w-7 text-white/10" />} text="No raffles entered." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
              <Ticket className="h-3.5 w-3.5 shrink-0 text-white/15" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-white">{entry.raffle?.title ?? "Deleted raffle"}</p>
                {entry.raffle?.prize_name && (
                  <p className="truncate text-[11px] text-white/30">{entry.raffle.prize_name}</p>
                )}
              </div>
              {entry.raffle && <Tag accent={statusAccent(entry.raffle.status)}>{entry.raffle.status}</Tag>}
              <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-white/50">
                {entry.tickets_purchased}x
              </span>
              <span className="w-20 shrink-0 text-right text-[13px] tabular-nums" style={{ color: ACCENTS.purple }}>
                {points(entry.points_spent)}
              </span>
              <MonoLabel className="w-36 shrink-0 text-right text-white/20">{when(entry.created_at)}</MonoLabel>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function WinsPanel({ wins }: { wins: WinLog[] }) {
  return (
    <Panel accent="purple">
      <PanelHeader
        title="Wins"
        accent="purple"
        right={<MonoLabel className="text-white/25">{wins.length} logged</MonoLabel>}
      />
      {wins.length === 0 ? (
        <Empty icon={<Trophy className="h-7 w-7 text-white/10" />} text="Nothing won yet." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {wins.map((win) => {
            const meta = sourceMeta(win.source)
            return (
              <li key={win.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
                <Tag accent={meta.accent}>{meta.label}</Tag>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white">{win.prize}</p>
                  {(win.source_ref || win.note) && (
                    <p className="truncate text-[11px] text-white/30">
                      {[win.source_ref, win.note].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Tag accent={win.status === "paid" ? "green" : "amber"}>
                  {win.status === "paid" ? "Paid" : "Pending"}
                </Tag>
                <span className="w-24 shrink-0 text-right text-[13px] tabular-nums" style={{ color: ACCENTS.green }}>
                  {winValue(win)}
                </span>
                <MonoLabel className="w-36 shrink-0 text-right text-white/20">{when(win.created_at)}</MonoLabel>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
