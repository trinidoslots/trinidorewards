"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { AutoHeight } from "@/components/auto-height"
import {
  ArrowLeft,
  Coins,
  CreditCard,
  Eye,
  EyeOff,
  LayoutGrid,
  Link2,
  Package,
  ShoppingBag,
  Ticket,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, Tag, type Accent } from "@/components/ui/panel"
import { PointsDialog } from "@/components/admin/points-dialog"
import { SelectMenu } from "@/components/ui/select-menu"
import { nextBalance, type PointsAction } from "@/lib/points"
import { createClient } from "@/lib/supabase/client"
import { sourceMeta, winValue, type WinLog } from "@/lib/wins"
import { CopyableId } from "@/components/ui/copyable-id"

/**
 * One user, everything about them.
 *
 * Laid out as a profile card on the left (who they are, their rank, their
 * balance) and the detail on the right: statistics, the account's data with
 * the Role dropdown, then the tabs for wins, redemptions and raffles.
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

type Rank = "user" | "code_user" | "moderator" | "admin"
type AdminState = { is_admin: boolean; rank?: Rank; is_self: boolean; is_owner?: boolean }

type Payload = {
  user: {
    id: string
    username: string
    kick_id: string | number | null
    avatar_url: string | null
    points_balance: number
    created_at: string
  }
  /** Absent from an older route, which is read as "a plain user". */
  admin?: AdminState
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

const RANKS: { value: Rank; label: string; hint: string; accent: Accent }[] = [
  { value: "user", label: "User", hint: "A regular viewer", accent: "slate" },
  { value: "code_user", label: "Code User", hint: "Code-User-only items, raffles and codes", accent: "purple" },
  { value: "moderator", label: "Moderator", hint: "Restricted admin panel", accent: "blue" },
  { value: "admin", label: "Admin", hint: "Full admin panel", accent: "amber" },
]

const rankOf = (admin: AdminState | undefined): Rank => admin?.rank ?? (admin?.is_admin ? "admin" : "user")

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "wins", label: "Wins", icon: Trophy },
  { id: "redemptions", label: "Redemptions", icon: ShoppingBag },
  { id: "raffles", label: "Raffles", icon: Ticket },
] as const
type Tab = (typeof TABS)[number]["id"]

/**
 * The tab panels slide the way the tabs run: moving right (Overview to Wins)
 * the old panel leaves to the left and the new one comes in from the right,
 * and the reverse going back. `custom` carries the direction to the exit too,
 * which has already been rendered with the old one otherwise.
 */
const SLIDE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const slide = {
  enter: (direction: number) => ({ x: direction * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -48, opacity: 0 }),
}

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
  /** 1 when the new tab is to the right of the old one, -1 when to the left. */
  const [direction, setDirection] = useState(1)
  const selectTab = (next: Tab) => {
    if (next === tab) return
    const index = (id: Tab) => TABS.findIndex((entry) => entry.id === id)
    setDirection(index(next) > index(tab) ? 1 : -1)
    setTab(next)
  }
  const [adjusting, setAdjusting] = useState(false)
  // Held locally so the balance updates the moment it is changed, rather than
  // waiting on a refetch of everything else on the page.
  const [balance, setBalance] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Could not load that user")
      setData(payload as Payload)
      setBalance(Number(payload?.user?.points_balance) || 0)
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
  const currentBalance = balance ?? (Number(user.points_balance) || 0)
  const admin: AdminState = data.admin ?? { is_admin: false, is_self: false, is_owner: false }
  const kickId = user.kick_id ? String(user.kick_id) : null

  async function applyPoints(action: PointsAction, amount: number) {
    const next = nextBalance(currentBalance, action, amount)
    const { error: problem } = await createClient()
      .from("users")
      .update({ points_balance: next })
      .eq("id", user.id)

    if (problem) {
      setError(problem.message || "Could not update that balance")
      return
    }
    setBalance(next)
    setAdjusting(false)
  }

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ProfileCard
          user={user}
          kickId={kickId}
          admin={admin}
          balance={currentBalance}
          onAdjust={() => setAdjusting(true)}
        />

        <div className="min-w-0 space-y-4">
          {/* Scrolls sideways on a narrow screen, without a visible bar: the
              tabs' -mb-px underline made the box 1px taller than its content,
              which put a vertical scrollbar with arrows next to the tabs. */}
          <nav className="hide-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden border-b border-white/[0.08]">
            {TABS.map(({ id, label, icon: Icon }) => {
              const count = id === "redemptions" ? redemptions.length : id === "wins" ? wins.length : id === "raffles" ? raffleEntries.length : 0
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  className="relative flex shrink-0 items-center gap-2 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-300"
                  style={{ color: tab === id ? ACCENTS.blue : "rgba(255,255,255,0.4)" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {count > 0 && <span className="text-white/25">{count}</span>}
                  {/* One underline that glides to the tab that was picked. */}
                  {tab === id && (
                    <motion.span
                      layoutId="user-tab-underline"
                      className="absolute inset-x-0 bottom-0 h-0.5"
                      style={{ backgroundColor: ACCENTS.blue }}
                      transition={{ duration: 0.3, ease: SLIDE_EASE }}
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* AutoHeight eases the height between panels of different
              lengths and clips the slide at the column's edges. */}
          <AutoHeight duration={0.3} ease={SLIDE_EASE}>
          <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={tab}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: SLIDE_EASE }}
            className="space-y-4"
          >
          {tab === "overview" && (
            <>
              <Panel>
                <PanelHeader title="User statistics" />
                <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Stat icon={Coins} accent="green" label="Points balance" value={points(currentBalance)} />
                  <Stat icon={ShoppingBag} accent="amber" label="Spent in store" value={points(totals.spentOnStore)} hint={`${totals.redemptions} redemptions`} />
                  <Stat icon={Ticket} accent="purple" label="Spent on raffles" value={points(totals.spentOnRaffles)} hint={`${totals.tickets} tickets`} />
                  <Stat icon={Wallet} accent="blue" label="Points spent in total" value={points(totals.spentTotal)} />
                  <Stat icon={Trophy} accent="pink" label="Wins logged" value={String(totals.wins)} />
                  <Stat
                    icon={Trophy}
                    accent="green"
                    label="Won in cash"
                    value={totals.wonCash > 0 ? `$${Math.round(totals.wonCash).toLocaleString("en-US")}` : "—"}
                  />
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="User data" />
                <div className="grid gap-x-4 gap-y-3 p-4 sm:grid-cols-2">
                  <DataField label="ID">
                    <span className="truncate font-mono text-[12.5px]">{user.id}</span>
                  </DataField>
                  <DataField label="Username">
                    <span className="truncate">@ {user.username}</span>
                  </DataField>
                  <DataField label="Kick ID">
                    <span className="truncate font-mono text-[12.5px]">{kickId ?? "Never signed in with Kick"}</span>
                  </DataField>
                  <DataField label="Joined">{when(user.created_at)}</DataField>
                  <RoleField
                    userId={user.id}
                    hasKick={!!kickId}
                    admin={admin}
                    onChange={(next) => setData((current) => (current ? { ...current, admin: next } : current))}
                  />
                  <DataField label="Points balance">
                    <span className="tabular-nums">{points(currentBalance)}</span>
                  </DataField>
                </div>
              </Panel>

              <div className="grid gap-3 xl:grid-cols-2">
                <AccountsPanel accounts={accounts} />
                <PaymentsPanel payments={payments} />
              </div>
            </>
          )}

          {tab === "wins" && <WinsPanel wins={wins} />}
          {tab === "redemptions" && <RedemptionsPanel redemptions={redemptions} spent={totals.spentOnStore} />}
          {tab === "raffles" && <RafflesPanel entries={raffleEntries} spent={totals.spentOnRaffles} />}
          </motion.div>
          </AnimatePresence>
          </AutoHeight>
        </div>
      </div>

      {adjusting && (
        <PointsDialog
          username={user.username}
          balance={currentBalance}
          onClose={() => setAdjusting(false)}
          onApply={applyPoints}
        />
      )}
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

/** The left column: picture, name, ids, rank and balance. */
function ProfileCard({
  user,
  kickId,
  admin,
  balance,
  onAdjust,
}: {
  user: Payload["user"]
  kickId: string | null
  admin: AdminState
  balance: number
  onAdjust: () => void
}) {
  const rank = RANKS.find((entry) => entry.value === rankOf(admin)) ?? RANKS[0]
  const color = ACCENTS[rank.accent]

  return (
    <Panel className="flex flex-col items-center gap-3 p-5 text-center lg:sticky lg:top-20">
      <Avatar url={user.avatar_url} username={user.username} />
      <div className="min-w-0 max-w-full">
        <h1 className="truncate text-xl font-semibold tracking-tight text-white">{user.username}</h1>
        <div className="mt-2 space-y-1">
          <IdLine label="User ID" value={user.id} />
          <IdLine label="Kick ID" value={kickId} />
        </div>
        <p className="mt-1.5 text-[12px] text-white/30">Joined {when(user.created_at)}</p>
      </div>

      <span
        className="rounded-md px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color, backgroundColor: `${color}1f`, border: `1px solid ${color}40` }}
      >
        {admin.is_owner ? "Main admin" : rank.label}
      </span>

      <button
        type="button"
        onClick={onAdjust}
        className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition hover:border-white/[0.16] hover:bg-white/[0.04]"
      >
        <MonoLabel className="text-white/35">Points balance</MonoLabel>
        <p className="mt-1 text-[22px] font-semibold tabular-nums" style={{ color: ACCENTS.green }}>
          {points(balance)}
        </p>
        <p className="mt-0.5 text-[11px] text-white/30">Click to add or remove</p>
      </button>
    </Panel>
  )
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  if (!url) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <UserRound className="h-10 w-10 text-white/20" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      className="h-24 w-24 shrink-0 rounded-xl border border-white/[0.08] object-cover"
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
    <span className="flex items-center justify-center gap-1.5">
      <MonoLabel className="text-white/25">{label}</MonoLabel>
      <CopyableId value={value} chars={6} />
    </span>
  )
}

/** One figure in the statistics grid: a coloured icon tile, the label, the value. */
function Stat({
  icon: Icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: typeof Coins
  accent: Accent
  label: string
  value: string
  hint?: string
}) {
  const color = ACCENTS[accent]
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1f`, border: `1px solid ${color}40` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11.5px] text-white/40">{label}</p>
        <p className="truncate text-[19px] font-semibold tabular-nums leading-tight text-white">{value}</p>
        {hint && <p className="text-[11px] text-white/25">{hint}</p>}
      </div>
    </div>
  )
}

/** A value in an outlined box with its label set into the border. */
function DataField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-md border border-white/[0.10] px-3 pb-2.5 pt-0.5">
      <legend className="px-1 text-[11px] text-white/40">{label}</legend>
      <div className="flex min-h-[22px] items-center text-[13.5px] text-white/85">{children}</div>
    </fieldset>
  )
}

/**
 * The rank: User, Code User, Moderator or Admin.
 *
 * Confirms before any change to panel access, because both directions matter:
 * granting hands over (part of) the panel, and there is no undo for someone
 * you lock out mid-stream other than setting them back.
 */
function RoleField({
  userId,
  hasKick,
  admin,
  onChange,
}: {
  userId: string
  hasKick: boolean
  admin: AdminState
  onChange: (admin: AdminState) => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const current = rankOf(admin)

  const locked = admin.is_owner === true || admin.is_self
  const reason = admin.is_owner
    ? "The main admin. Their rank cannot be changed here."
    : admin.is_self
      ? "You cannot change your own rank."
      : null

  const change = async (next: Rank) => {
    if (next === current) return
    const staffNow = current === "admin" || current === "moderator"
    const staffNext = next === "admin" || next === "moderator"
    if (staffNow || staffNext) {
      const label = RANKS.find((entry) => entry.value === next)?.label ?? next
      const question = staffNext
        ? `Make this account ${label}? ${next === "admin" ? "That is full access to the admin panel." : "They get the moderator pages of the admin panel."}`
        : "Remove this account's admin panel access? It takes effect on their next click."
      if (!window.confirm(question)) return
    }

    setBusy(true)
    setProblem(null)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Could not save.")
      onChange({ ...admin, ...payload.admin })
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "Could not save.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className="min-w-0 rounded-md border border-white/[0.10] px-3 pb-2.5 pt-0.5" title={reason ?? undefined}>
      <legend className="px-1 text-[11px] text-white/40">Role</legend>
      <SelectMenu
        aria-label="Role"
        value={current}
        onChange={(value) => void change(value as Rank)}
        disabled={busy || locked}
        options={RANKS.map((entry) => ({
          value: entry.value,
          label: entry.label,
          hint: (entry.value === "admin" || entry.value === "moderator") && !hasKick ? "Needs a Kick login" : entry.hint,
          disabled: (entry.value === "admin" || entry.value === "moderator") && !hasKick,
        }))}
        // The fieldset is the box; the dropdown sits in it like the other values.
        className="!h-[22px] !border-0 !bg-transparent !px-0 text-[13.5px]"
      />
      {(problem || reason || busy) && (
        <p className="mt-1.5 text-[11px]" style={{ color: problem ? ACCENTS.red : "rgba(255,255,255,0.3)" }}>
          {busy ? "Saving…" : problem ?? reason}
        </p>
      )}
    </fieldset>
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
