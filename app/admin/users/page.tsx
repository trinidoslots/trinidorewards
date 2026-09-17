"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight, Coins, RefreshCw, Search, UserRound, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"

/**
 * The user list.
 *
 * A directory rather than a control panel: the row is a way into the user's own
 * page, and the only thing done inline is adjusting points, which is the one
 * action that is genuinely done in bulk.
 */

type User = {
  id: string
  username: string
  kick_id: string | null
  points_balance: number
  avatar_url: string | null
  created_at: string
}

type SortKey = "registered" | "points" | "username"

const points = (value: number) => Math.round(Number(value) || 0).toLocaleString()

export default function AdminUsersPage() {
  const supabaseRef = useRef(createClient())

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("registered")
  const [editing, setEditing] = useState<User | null>(null)
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    // Deliberately "*" rather than a column list. No migration ever created
    // this table, so what is on it is whatever the dashboard was set up with —
    // naming a column that does not exist turns the whole page into an error,
    // which is exactly what naming avatar_url did.
    const { data, error } = await supabaseRef.current
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Could not load users:", error)
      // The real message, not a generic line: "column users.avatar_url does not
      // exist" tells you what to do, "Could not load users" does not.
      setNotice({ tone: "error", text: error.message || "Could not load users." })
    } else {
      setUsers((data ?? []) as User[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? users.filter(
          (user) =>
            user.username?.toLowerCase().includes(needle) ||
            user.kick_id?.toLowerCase().includes(needle) ||
            user.id.toLowerCase().includes(needle),
        )
      : users

    const sorted = [...filtered]
    if (sort === "points") sorted.sort((a, b) => Number(b.points_balance) - Number(a.points_balance))
    else if (sort === "username") sorted.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
    else sorted.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    return sorted
  }, [users, query, sort])

  const totals = useMemo(
    () => ({
      users: users.length,
      points: users.reduce((sum, user) => sum + (Number(user.points_balance) || 0), 0),
      withPoints: users.filter((user) => Number(user.points_balance) > 0).length,
    }),
    [users],
  )

  async function applyPoints(user: User, action: "add" | "remove" | "set", amount: number) {
    const next =
      action === "add"
        ? Number(user.points_balance) + amount
        : action === "remove"
          ? Math.max(0, Number(user.points_balance) - amount)
          : amount

    const { error } = await supabaseRef.current.from("users").update({ points_balance: next }).eq("id", user.id)
    if (error) {
      console.error("[v0] Could not update points:", error)
      setNotice({ tone: "error", text: "Could not update that balance." })
      return
    }
    setUsers((current) =>
      current.map((entry) => (entry.id === user.id ? { ...entry, points_balance: next } : entry)),
    )
    setNotice({ tone: "info", text: `${user.username} is now on ${points(next)} points.` })
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Users</h1>
          <p className="mt-1 text-[13px] text-white/40">Open a user for their accounts, payouts and redemptions.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {notice && (
        <Panel
          accent={notice.tone === "error" ? "red" : "blue"}
          className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]"
          style={{ color: notice.tone === "error" ? ACCENTS.red : ACCENTS.blue }}
        >
          {notice.text}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="ml-auto rounded p-1 text-white/25 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Users" value={totals.users.toLocaleString()} />
        <StatTile label="Points in circulation" value={points(totals.points)} accent="green" />
        <StatTile label="Holding points" value={totals.withPoints.toLocaleString()} accent="blue" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username, Kick ID, user ID…"
              className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-9 rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition focus:border-white/25"
          >
            <option value="registered" className="bg-[#121216]">Newest first</option>
            <option value="points" className="bg-[#121216]">Most points</option>
            <option value="username" className="bg-[#121216]">Username A–Z</option>
          </select>
          <MonoLabel className="text-white/25">
            {rows.length} {rows.length === 1 ? "user" : "users"}
          </MonoLabel>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <UserRound className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">No users{query ? " match that search" : " yet"}.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {rows.map((user) => (
              <li key={user.id} className="group flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-white/[0.03]">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-md border border-white/[0.08] object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none"
                    }}
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                    <UserRound className="h-4 w-4 text-white/20" />
                  </div>
                )}

                <Link href={`/admin/users/${user.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-white">{user.username}</p>
                  <p className="text-[11px] text-white/25">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </Link>

                {/* Both ids copyable — they were readable but not selectable
                    before, which meant retyping a uuid by hand. */}
                <div className="hidden shrink-0 items-center gap-3 md:flex">
                  <span className="flex items-center gap-1.5">
                    <MonoLabel className="text-white/20">ID</MonoLabel>
                    <CopyableId value={user.id} chars={5} />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MonoLabel className="text-white/20">Kick</MonoLabel>
                    <CopyableId value={user.kick_id} chars={5} />
                  </span>
                </div>

                <span
                  className="w-24 shrink-0 text-right text-[13px] tabular-nums"
                  style={{ color: ACCENTS.green }}
                >
                  {points(user.points_balance)}
                </span>

                <button
                  type="button"
                  onClick={() => setEditing(user)}
                  aria-label={`Adjust points for ${user.username}`}
                  className="shrink-0 rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Coins className="h-3.5 w-3.5" />
                </button>

                <Link
                  href={`/admin/users/${user.id}`}
                  aria-label={`Open ${user.username}`}
                  className="shrink-0 rounded p-1.5 text-white/20 transition group-hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && <PointsDialog user={editing} onClose={() => setEditing(null)} onApply={applyPoints} />}
    </div>
  )
}

function PointsDialog({
  user,
  onClose,
  onApply,
}: {
  user: User
  onClose: () => void
  onApply: (user: User, action: "add" | "remove" | "set", amount: number) => Promise<void>
}) {
  const [action, setAction] = useState<"add" | "remove" | "set">("add")
  const [raw, setRaw] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const amount = Number.parseInt(raw, 10)
  // "set" to zero is a legitimate correction; adding or removing nothing is not.
  const valid = Number.isFinite(amount) && (action === "set" ? amount >= 0 : amount > 0)
  const preview = !valid
    ? null
    : action === "add"
      ? Number(user.points_balance) + amount
      : action === "remove"
        ? Math.max(0, Number(user.points_balance) - amount)
        : amount

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Adjust points for ${user.username}`}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-white/[0.10] bg-[#0E0E11]"
      >
        <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <MonoLabel className="text-white/70">Points</MonoLabel>
          <span className="truncate text-[13px] text-white/40">{user.username}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            {(["add", "remove", "set"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAction(option)}
                className="rounded-md border py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition"
                style={
                  action === option
                    ? { borderColor: `${ACCENTS.blue}77`, backgroundColor: `${ACCENTS.blue}1f`, color: ACCENTS.blue }
                    : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                }
              >
                {option}
              </button>
            ))}
          </div>

          <div>
            <MonoLabel className="mb-1.5 block text-white/30">Amount</MonoLabel>
            <input
              type="number"
              min="0"
              autoFocus
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              className="h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] tabular-nums text-white outline-none transition focus:border-white/25"
            />
          </div>

          <p className="text-[12px] text-white/35">
            {points(user.points_balance)}
            {preview !== null && (
              <>
                {" → "}
                <span style={{ color: ACCENTS.green }}>{points(preview)}</span>
              </>
            )}
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true)
              await onApply(user, action, amount)
              setBusy(false)
            }}
            className="inline-flex h-9 items-center rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ backgroundColor: ACCENTS.green }}
          >
            {busy ? "Saving…" : "Apply"}
          </button>
        </footer>
      </div>
    </div>
  )
}
