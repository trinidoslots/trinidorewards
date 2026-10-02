"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { usePathname, useSearchParams } from "next/navigation"
import { Activity, ArrowRight, Gift, Package, Settings, Swords, Target, Ticket, Trophy } from "lucide-react"
import { ACCENTS, MonoLabel, type Accent } from "@/components/ui/panel"
import {
  ConnectedAccountsPanel,
  ConnectionsPanel,
  Empty,
  MyWinsPanel,
  PaymentMethodsPanel,
  ProfileCard,
  StatusPill,
} from "@/components/profile-panels"
import { PageBody, PageHero, PageHeroSkeleton } from "@/components/page-hero"
import { Swap } from "@/components/swap"
import { TabSlide } from "@/components/tab-slide"
import type { ActivityItem } from "@/app/api/profile/overview/route"

/**
 * The player's own page.
 *
 * The site's page header carries who they are — avatar, name, rank, the
 * numbers that sum them up — with their points in the panel on the right,
 * where every other page puts the figure it is about. Tabs below.
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
  { id: "redemptions", label: "Purchases" },
  { id: "settings", label: "Settings" },
] as const
type TabId = (typeof TABS)[number]["id"]

const BLUE = ACCENTS.blue
const points = (value: number) => Math.round(Number(value) || 0).toLocaleString("en-US")

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"

function statusAccent(status: string): Accent {
  if (status === "completed" || status === "approved") return "green"
  if (status === "rejected" || status === "cancelled") return "red"
  return "amber"
}

const ACTIVITY_ICON: Record<ActivityItem["kind"], { icon: typeof Gift; accent: Accent }> = {
  redemption: { icon: Package, accent: "pink" },
  raffle: { icon: Ticket, accent: "green" },
  prediction: { icon: Target, accent: "amber" },
  tournament: { icon: Swords, accent: "purple" },
  win: { icon: Trophy, accent: "amber" },
}

function ProfileView() {
  const params = useSearchParams()
  const pathname = usePathname()
  const [data, setData] = useState<Overview | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)

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
        <div>
          <ProfileHero data={data} onSettings={() => setTab("settings")} />

          <PageBody className="space-y-6">
            <nav
              className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-white/[0.10] bg-black/40 p-1"
              aria-label="Profile sections"
            >
              {TABS.map((entry) => {
                const active = tab === entry.id
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setTab(entry.id)}
                    aria-current={active ? "page" : undefined}
                    className="relative rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-200"
                    style={{ color: active ? "#000" : "rgba(255,255,255,0.55)" }}
                  >
                    {/* One fill that glides to the picked tab. */}
                    {active && (
                      <motion.span
                        layoutId="profile-tab"
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: BLUE }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                    <span className="relative">{entry.label}</span>
                  </button>
                )
              })}
            </nav>

            {/* The same slide as the admin's user page: to a tab on the right,
                the panel comes in from the right; to one on the left, from the left. */}
            <TabSlide tab={tab} index={TABS.findIndex((entry) => entry.id === tab)}>
              {tab === "overview" && <OverviewTab data={data} />}
              {tab === "stats" && <StatsTab data={data} />}
              {tab === "wins" && <MyWinsPanel />}
              {tab === "redemptions" && <PurchasesTab redemptions={redemptions} spent={data.spent.store} />}
              {tab === "settings" && (
                <div className="space-y-4">
                  <ConnectionsPanel />
                  <div className="grid items-start gap-4 lg:grid-cols-2">
                    <ConnectedAccountsPanel />
                    <PaymentMethodsPanel />
                  </div>
                </div>
              )}
            </TabSlide>
          </PageBody>
        </div>
      )}
    </Swap>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Header                                   */
/* -------------------------------------------------------------------------- */

function Avatar({ user }: { user: Overview["user"] }) {
  const [broken, setBroken] = useState(false)
  return user.avatar_url && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element -- Kick avatar from their CDN
    <img
      src={user.avatar_url}
      alt=""
      onError={() => setBroken(true)}
      className="h-20 w-20 rounded-xl border-2 object-cover md:h-24 md:w-24"
      style={{ borderColor: `${BLUE}66`, boxShadow: `0 20px 50px -20px ${BLUE}` }}
    />
  ) : (
    <span
      className="flex h-20 w-20 items-center justify-center rounded-xl border-2 text-[34px] font-black text-white md:h-24 md:w-24"
      style={{ borderColor: `${BLUE}66`, backgroundColor: `${BLUE}26` }}
    >
      {user.username.slice(0, 1).toUpperCase()}
    </span>
  )
}

function ProfileHero({ data, onSettings }: { data: Overview; onSettings: () => void }) {
  const { user } = data
  const stats: [string, number][] = [
    ["Wins", data.counts.wins],
    ["Predictions", data.counts.predictions],
    ["Tournaments", data.counts.tournaments],
    ["Raffles", data.counts.raffles],
  ]

  return (
    <PageHero
      accent="blue"
      switcher={<Avatar user={user} />}
      note={`Rank #${data.rank.toLocaleString("en-US")} · Member since ${date(user.created_at)}`}
      title={user.username}
      actions={
        <>
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
        </>
      }
      aside={<PointsPanel data={data} />}
    >
      <dl className="mt-8 grid max-w-xl grid-cols-4 gap-x-4">
        {stats.map(([label, value]) => (
          <div key={label} className="border-t border-white/[0.10] pt-3">
            <dd className="text-[22px] font-black leading-none tabular-nums text-white">{value.toLocaleString("en-US")}</dd>
            <dt className="mt-1.5">
              <MonoLabel className="text-white/40">{label}</MonoLabel>
            </dt>
          </div>
        ))}
      </dl>
    </PageHero>
  )
}

/**
 * The balance, and how much of what was ever earned is still held.
 *
 * Earned is balance plus what went to the store and to raffles, the only two
 * ways points leave.
 */
function PointsPanel({ data }: { data: Overview }) {
  const balance = data.user.points_balance
  const earned = balance + data.spent.total
  const held = earned > 0 ? Math.min(100, (balance / earned) * 100) : 0

  return (
    <div>
      <MonoLabel style={{ color: BLUE }}>Your points</MonoLabel>
      <p className="mt-3 flex items-baseline gap-2 leading-none">
        <span className="text-[clamp(40px,5vw,56px)] font-black tabular-nums tracking-[-0.02em] text-white">{points(balance)}</span>
        <span className="text-[15px] font-semibold text-white/45">pts</span>
      </p>

      <div className="mt-6 border-t border-white/[0.07] pt-5">
        <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
          <span className="text-white/45">Still held of {points(earned)} earned</span>
          <span className="font-semibold tabular-nums text-white">{Math.round(held)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${held}%`, backgroundColor: BLUE }} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-white/45">
            Spent <span className="font-semibold tabular-nums text-white/80">{points(data.spent.total)}</span>
          </span>
          <Link
            href="/store"
            className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/75 transition hover:text-white"
          >
            Spend in the store
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                    Tabs                                    */
/* -------------------------------------------------------------------------- */

function OverviewTab({ data }: { data: Overview }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ProfileCard title="Recent activity" accent="blue">
        {data.activity.length === 0 ? (
          <Empty
            icon={<Activity className="h-7 w-7 text-white/15" />}
            text="No activity yet"
            note="Predictions, raffle tickets, tournaments and purchases show up here."
          />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {data.activity.map((item) => {
              const { icon: Icon, accent } = ACTIVITY_ICON[item.kind]
              return (
                <li key={item.id} className="flex items-center gap-3.5 px-5 py-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${ACCENTS[accent]}1f` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: ACCENTS[accent] }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-white">{item.title}</p>
                    {item.detail && <p className="truncate text-[12px] text-white/40">{item.detail}</p>}
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-white/40">{date(item.at)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </ProfileCard>

      <ProfileCard title="Member info" accent="slate">
        <dl className="divide-y divide-white/[0.06]">
          {[
            ["Member since", date(data.user.created_at)],
            ["Last seen", date(data.user.last_seen)],
            ["Rank by points", `#${data.rank.toLocaleString("en-US")}`],
            ["Raffle tickets", data.counts.tickets.toLocaleString("en-US")],
            ["Purchases", data.counts.redemptions.toLocaleString("en-US")],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-5 py-3 text-[13.5px]">
              <dt className="text-white/50">{label}</dt>
              <dd className="font-semibold tabular-nums text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </ProfileCard>
    </div>
  )
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: Accent }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E12] p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: ACCENTS[accent] }} />
      <MonoLabel style={{ color: ACCENTS[accent] }}>{label}</MonoLabel>
      <p className="mt-3 text-[30px] font-black leading-none tabular-nums tracking-[-0.02em] text-white">{value}</p>
      {hint && <p className="mt-2 text-[12.5px] text-white/40">{hint}</p>}
    </div>
  )
}

function StatsTab({ data }: { data: Overview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Points balance" value={points(data.user.points_balance)} accent="blue" hint={`Rank #${data.rank.toLocaleString("en-US")} by points held`} />
      <StatCard label="Spent in the store" value={points(data.spent.store)} accent="pink" hint={`${data.counts.redemptions} purchases`} />
      <StatCard label="Spent on raffles" value={points(data.spent.raffles)} accent="green" hint={`${data.counts.tickets} tickets`} />
      <StatCard label="Hunt predictions" value={data.counts.predictions.toLocaleString("en-US")} accent="amber" />
      <StatCard label="Tournaments joined" value={data.counts.tournaments.toLocaleString("en-US")} accent="purple" />
      <StatCard label="Wins" value={data.counts.wins.toLocaleString("en-US")} accent="green" />
    </div>
  )
}

function PurchasesTab({ redemptions, spent }: { redemptions: Redemption[]; spent: number }) {
  return (
    <ProfileCard
      title="Store purchases"
      accent="pink"
      right={<MonoLabel className="text-white/35">{points(spent)} pts spent</MonoLabel>}
    >
      {redemptions.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-8">
          <Empty icon={<Package className="h-7 w-7 text-white/15" />} text="Nothing bought yet" />
          <Link
            href="/store"
            className="-mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 text-[13.5px] font-semibold text-white transition hover:border-white/30"
          >
            Go to the store <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {redemptions.map((redemption) => (
            <li key={redemption.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${ACCENTS.pink}1f` }}
              >
                <Package className="h-4 w-4" style={{ color: ACCENTS.pink }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{redemption.item_name}</p>
                <p className="text-[12px] text-white/40">{date(redemption.created_at)}</p>
              </div>
              <StatusPill accent={statusAccent(redemption.status)}>
                {redemption.status.charAt(0).toUpperCase() + redemption.status.slice(1)}
              </StatusPill>
              <span className="w-24 shrink-0 text-right text-[15px] font-bold tabular-nums text-white">
                {points(redemption.cost)} <span className="text-[12px] font-semibold text-white/40">pts</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  )
}

/**
 * The waiting state, shaped like the page it becomes, so the cross-fade moves
 * content into place rather than one page replacing another.
 */
function ProfileLoading() {
  return (
    <div>
      <PageHeroSkeleton accent="blue" panel />
      <PageBody className="space-y-6">
        <Ghost className="h-[42px] w-[460px] max-w-full rounded-full" />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Ghost className="h-[320px]" />
          <Ghost className="h-[260px]" />
        </div>
      </PageBody>
    </div>
  )
}

/** A card-shaped placeholder. Pulses, so it reads as pending rather than empty. */
function Ghost({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] ${className ?? ""}`} aria-hidden="true" />
}

export default function ProfilePage() {
  // useSearchParams (the tab) needs a suspense boundary to stay prerenderable.
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileView />
    </Suspense>
  )
}
