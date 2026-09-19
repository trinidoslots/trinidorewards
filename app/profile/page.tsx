"use client"

import { useEffect, useState } from "react"
import { Package } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { createClient } from "@/lib/supabase/client"
import { CopyableId } from "@/components/ui/copyable-id"
import { ConnectedAccountsPanel, MyWinsPanel, PaymentMethodsPanel } from "@/components/profile-panels"
import { PageBody, PageHero } from "@/components/page-hero"

/**
 * The player's own page: what they have, where they play, and where they want
 * to be paid.
 *
 * The two editable panels live in their own component because they go through
 * the API rather than the browser Supabase client — see profile-panels.tsx.
 */

type Redemption = {
  id: string
  item_name: string
  cost: number
  status: string
  created_at: string
}

type SessionUser = {
  id: string
  username: string
  avatar_url: string | null
  points_balance: number
}

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric" })

function statusAccent(status: string) {
  if (status === "completed" || status === "approved") return "green" as const
  if (status === "rejected" || status === "cancelled") return "red" as const
  return "amber" as const
}

export default function ProfilePage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        const session = await response.json()
        if (!session.user) {
          window.location.href = "/"
          return
        }
        if (cancelled) return
        setUser(session.user as SessionUser)

        const { data, error } = await createClient()
          .from("redemptions")
          .select("id, item_name, cost, status, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })

        if (error) console.error("[v0] Could not load redemptions:", error)
        if (!cancelled) setRedemptions((data ?? []) as Redemption[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div>
        <PageHero accent="blue" title="Profile" subtitle="Loading your account." />
      </div>
    )
  }

  if (!user) return null

  // Rejected redemptions were refunded, so counting them would tell the user
  // they spent points they still have.
  const spent = redemptions
    .filter((entry) => entry.status !== "rejected" && entry.status !== "cancelled")
    .reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0)

  return (
    <div>
      <PageHero
        accent="blue"
        figure={points(user.points_balance)}
        figureLabel="Points"
        title={user.username}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] px-3 py-1.5">
            <MonoLabel className="text-white/25">Your ID</MonoLabel>
            <CopyableId value={user.id} chars={6} />
          </span>
        }
      >
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt=""
            className="mx-auto mt-6 h-16 w-16 rounded-full border-2 border-white/[0.10] object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        )}
      </PageHero>
      <PageBody className="space-y-4">

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Points balance" value={points(user.points_balance)} accent="green" />
        <StatTile label="Points spent" value={points(spent)} accent="amber" />
        <StatTile label="Redemptions" value={redemptions.length.toLocaleString()} accent="blue" />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <ConnectedAccountsPanel />
          <PaymentMethodsPanel />
        </div>

        <div className="space-y-3">
        <MyWinsPanel />

        <Panel accent="amber">
          <PanelHeader
            title="Redemption history"
            accent="amber"
            right={<MonoLabel className="text-white/25">{points(spent)} spent</MonoLabel>}
          />
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
                    <p className="text-[11px] text-white/25">{when(redemption.created_at)}</p>
                  </div>
                  <Tag accent={statusAccent(redemption.status)}>{redemption.status}</Tag>
                  <span
                    className="w-20 shrink-0 text-right text-[13px] tabular-nums"
                    style={{ color: ACCENTS.amber }}
                  >
                    {points(redemption.cost)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        </div>
      </div>
      </PageBody>
    </div>
  )
}
