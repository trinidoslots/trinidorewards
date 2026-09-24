"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Activity, Gift, Package, Settings, Swords, Target, Ticket, Trophy } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag, type Accent } from "@/components/ui/panel"
import { ConnectedAccountsPanel, MyWinsPanel, PaymentMethodsPanel } from "@/components/profile-panels"
import { Swap } from "@/components/swap"
import type { ActivityItem } from "@/app/api/profile/overview/route"

/**
 * The player's own page, laid out like a player card: who they are and where
 * they stand at the top, then tabs.
 *
 * The reference layout has a level bar and Achievements / Friends tabs. This
 * site has no levels, achievements or friends, so those slots hold what it
 * does have: the bar shows how much of what you earned you still hold, and
 * the tabs are Wins, Redemptions and Settings.
 */

type Redemption = { id: string; item_name: string; cost: number; status: string; created_at: string }

type Overview = {
  user: {
    id: string
    username: string
    avatar_url: string | null
    points_balance: number
    created_at: string | null
    last_seen: string | null
  }
  rank: number
  counts: { predictions: number; tournaments: number; raffles: number; tickets: number; wins: number; redemptions: number }
  spent: { store: number; raffles: number; total: number }
  activity: ActivityItem[]
  redemptions?: Redemption[]
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "wins", label: "Wins" },
  { id: "redemptions", label: "Redemptions" },
  { id: "settings", label: "Settings" },
] as const
type TabId = (typeof TABS)[number]["id"]

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString("en-US")

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "numeric", year: "numeric" }) : "—"

function statusAccent(status: string): Accent {
  if (status === "completed" || status === "approved") return "green"
  if (status === "rejected" || status === "cancelled") return "red"
  return "amber"
}

const ACTIVITY_ICON: Record<ActivityItem["kind"], { icon: typeof Gift; accent: Accent }> = {
  redemption: { icon: Package, accent: "amber" },
  raffle: { icon: Ticket, accent: "purple" },
  prediction: { icon: Target, accent: "blue" },
  tournament: { icon: Swords, accent: "blue" },
  win: { icon: Trophy, accent: "green" },
}

function ProfileView() {
  const params = useSearchParams()
  const pathname = usePathname()
  const [data, setData] = useState<Overview | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [avatarBroken, setAvatarBroken] = useState(false)

  const requested = params.get("tab")
  const tab: TabId = TABS.some((entry) => entry.id === requested) ? (requested as TabId) : "overview"
  // replaceState, not router.replace: a router navigation re-mounts the page
  // through app/template.tsx, which refetched everything and replayed the
  // page transition on every tab click. Next keeps useSearchParams in step
  // with replaceState, so the tab still follows the URL (and the Settings
  // link in the account menu still lands on the right one).
  const setTab = (next: TabId) =>
    window.history.replaceState(null, "", next === "overview" ? pathname : `${pathname}?tab=${next}`)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/profile/overview", { cache: "no-store" })
        if (response.status === 401) {
          window.location.href = "/"
          return
        }
        const overview = (await response.json()) as Overview
        if (cancelled || !overview?.user) return
        setData(overview)
        // From the server route: redemptions are not publicly readable (072).
        setRedemptions(overview.redemptions ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Swap on={loading ? "loading" : "profile"}>
      {loading || !data ? (
        <ProfileLoading />
      ) : (
        <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-6 md:px-8">
          <ProfileHeader data={data} avatarBroken={avatarBroken} onAvatarError={() => setAvatarBroken(true)} onSettings={() => setTab("settings")} />

          <nav className="inline-flex flex-wrap gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1" aria-label="Profile sections">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                aria-current={tab === entry.id ? "page" : undefined}
                className="rounded-full px-4 py-1.5 text-[13px] font-medium transition"
                style={tab === entry.id ? { backgroundColor: "rgba(255,255,255,0.09)", color: "#fff" } : { color: "rgba(255,255,255,0.45)" }}
              >
                {entry.label}
              </button>
            ))}
          </nav>

          {tab === "overview" && <OverviewTab data={data} />}
          {tab === "stats" && <StatsTab data={data} />}
          {tab === "wins" && <MyWinsPanel />}
          {tab === "redemptions" && <RedemptionsTab redemptions={redemptions} spent={data.spent.store} />}
          {tab === "settings" && (
            <div className="grid items-start gap-3 lg:grid-cols-2">
              <ConnectedAccountsPanel />
              <PaymentMethodsPanel />
            </div>
          )}
        </div>
      )}
    </Swap>
  )
}

function ProfileHeader({
  data,
  avatarBroken,
  onAvatarError,
  onSettings,
}: {
  data: Overview
  avatarBroken: boolean
  onAvatarError: () => void
  onSettings: () => void
}) {
  const { user } = data
  // Where the reference has a level bar: of everything you have earned, how
  // much you still hold. Earned is balance plus what went to the store and to
  // raffles, the only two ways points leave.
  const earned = user.points_balance + data.spent.total
  const held = earned > 0 ? Math.min(100, (user.points_balance / earned) * 100) : 0

  return (
    <Panel className="p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-5">
        {user.avatar_url && !avatarBroken ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full border-2 object-cover md:h-24 md:w-24"
            style={{ borderColor: `${ACCENTS.blue}66` }}
            onError={onAvatarError}
          />
        ) : (
          <span
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-3xl font-bold text-white md:h-24 md:w-24"
            style={{ backgroundColor: `${ACCENTS.blue}33` }}
          >
            {user.username.slice(0, 1).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-[26px] font-black uppercase italic tracking-tight text-white md:text-[32px]">
              {user.username}
            </h1>
            <button
              type="button"
              onClick={onSettings}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12px] font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </button>
          </div>
          <p className="mt-1 text-[13px] text-white/40">
            @{user.username} <span className="mx-1.5 text-white/20">•</span> Rank #{data.rank.toLocaleString("en-US")}
          </p>
        </div>

        <div className="flex gap-8 text-center">
          <div>
            <p className="text-[26px] font-bold tabular-nums text-white">{points(user.points_balance)}</p>
            <MonoLabel className="text-white/35">Points</MonoLabel>
          </div>
          <div>
            <p className="text-[26px] font-bold tabular-nums text-white">{data.counts.wins.toLocaleString("en-US")}</p>
            <MonoLabel className="text-white/35">Wins</MonoLabel>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <div className="mb-2 flex items-center justify-between text-[12px] text-white/40">
          <span>Balance</span>
          <span className="tabular-nums">
            {points(user.points_balance)} / {points(earned)} points kept
          </span>
          <span>Spent {points(data.spent.total)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${held}%`, backgroundColor: ACCENTS.blue }} />
        </div>
      </div>
    </Panel>
  )
}

function OverviewTab({ data }: { data: Overview }) {
  const tiles: { label: string; value: number; accent: Accent }[] = [
    { label: "Predictions", value: data.counts.predictions, accent: "blue" },
    { label: "Tournaments", value: data.counts.tournaments, accent: "amber" },
    { label: "Raffles", value: data.counts.raffles, accent: "purple" },
    { label: "Wins", value: data.counts.wins, accent: "green" },
  ]

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Panel className="p-5">
          <p className="mb-3 text-[15px] font-semibold text-white">Quick Stats</p>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {tiles.map((tile) => (
              <StatTile key={tile.label} label={tile.label} value={tile.value.toLocaleString("en-US")} accent={tile.accent} />
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="mb-3 text-[15px] font-semibold text-white">Recent Activity</p>
          {data.activity.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-white/30">
              <Activity className="h-7 w-7" />
              <p className="text-[13px]">No recent activity</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {data.activity.map((item) => {
                const { icon: Icon, accent } = ACTIVITY_ICON[item.kind]
                return (
                  <li key={item.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${ACCENTS[accent]}1f` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: ACCENTS[accent] }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-white">{item.title}</p>
                      {item.detail && <p className="truncate text-[11px] text-white/35">{item.detail}</p>}
                    </div>
                    <span className="shrink-0 text-[11px] text-white/30">{date(item.at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="p-5">
        <p className="mb-3 text-[15px] font-semibold text-white">Member Info</p>
        <dl className="space-y-3 text-[13px]">
          {[
            ["Member since", date(data.user.created_at)],
            ["Last seen", date(data.user.last_seen)],
            ["Predictions", data.counts.predictions.toLocaleString("en-US")],
            ["Raffle tickets", data.counts.tickets.toLocaleString("en-US")],
            ["Redemptions", data.counts.redemptions.toLocaleString("en-US")],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-white/45">{label}</dt>
              <dd className="font-semibold tabular-nums text-white">{value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/store"
          className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] py-2 text-[12px] text-white/60 transition hover:bg-white/[0.04] hover:text-white"
        >
          <Gift className="h-3.5 w-3.5" /> Spend points in the store
        </Link>
      </Panel>
    </div>
  )
}

function StatsTab({ data }: { data: Overview }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      <StatTile label="Points balance" value={points(data.user.points_balance)} accent="green" />
      <StatTile label="Spent in store" value={points(data.spent.store)} accent="amber" hint={`${data.counts.redemptions} redemptions`} />
      <StatTile label="Spent on raffles" value={points(data.spent.raffles)} accent="purple" hint={`${data.counts.tickets} tickets`} />
      <StatTile label="Rank" value={`#${data.rank.toLocaleString("en-US")}`} accent="blue" hint="By points held" />
      <StatTile label="Hunt predictions" value={data.counts.predictions.toLocaleString("en-US")} accent="blue" />
      <StatTile label="Tournaments joined" value={data.counts.tournaments.toLocaleString("en-US")} accent="amber" />
    </div>
  )
}

function RedemptionsTab({ redemptions, spent }: { redemptions: Redemption[]; spent: number }) {
  return (
    <Panel accent="amber">
      <PanelHeader title="Redemption history" accent="amber" right={<MonoLabel className="text-white/25">{points(spent)} spent</MonoLabel>} />
      {redemptions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <Package className="h-7 w-7 text-white/10" />
          <p className="text-[13px] text-white/30">Nothing redeemed yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {redemptions.map((redemption) => (
            <li key={redemption.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <Package className="h-3.5 w-3.5 shrink-0 text-white/15" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-white">{redemption.item_name}</p>
                <p className="text-[11px] text-white/25">{date(redemption.created_at)}</p>
              </div>
              <Tag accent={statusAccent(redemption.status)}>{redemption.status}</Tag>
              <span className="w-20 shrink-0 text-right text-[13px] tabular-nums" style={{ color: ACCENTS.amber }}>
                {points(redemption.cost)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * The waiting state, shaped like the page it becomes, so the cross-fade moves
 * content into place rather than one page replacing another.
 */
function ProfileLoading() {
  return (
    <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-6 md:px-8">
      <Ghost className="h-[190px]" />
      <Ghost className="h-[42px] w-[440px] max-w-full rounded-full" />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Ghost className="h-[150px]" />
          <Ghost className="h-[220px]" />
        </div>
        <Ghost className="h-[260px]" />
      </div>
    </div>
  )
}

/** A panel-shaped placeholder. Pulses, so it reads as pending rather than empty. */
function Ghost({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.015] ${className ?? ""}`} aria-hidden="true" />
  )
}

export default function ProfilePage() {
  // useSearchParams (the tab) needs a suspense boundary to stay prerenderable.
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileView />
    </Suspense>
  )
}
