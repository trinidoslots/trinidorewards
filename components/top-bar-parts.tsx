"use client"

import { adminUrl } from "@/lib/admin-host"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Coins,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  Settings,
  TicketCheck,
  Trophy,
  User,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { signOut } from "@/hooks/use-site-session"
import { siteHref } from "@/lib/site-url"
import { openRedeem } from "@/components/redeem-modal"
import type { SiteNotification } from "@/app/api/notifications/route"

/**
 * The pieces the site's top bar and the admin panel's top bar share: the
 * account box with its menu, the notification bell, the points pill.
 */

/** Our panel surface for a floating menu, instead of the shadcn theme defaults. */
export const MENU_CLASS =
  "min-w-[220px] rounded-lg border border-white/[0.10] bg-[#0E0E11] p-1 text-white shadow-2xl shadow-black/60"
export const MENU_ITEM_CLASS =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-white/70 outline-none transition focus:bg-white/[0.06] focus:text-white [&_svg]:text-white/40"

export function formatPoints(value: number) {
  return Math.round(Number(value) || 0).toLocaleString("en-US")
}

export function Avatar({ url, name, size = 28 }: { url: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        // A Kick avatar URL can rot; fall back to the initial rather than a
        // broken-image glyph.
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: `${ACCENTS.blue}44` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function PointsPill({ points }: { points: number }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5">
      <Coins className="h-4 w-4" style={{ color: ACCENTS.amber }} />
      <span className="text-[14px] font-semibold tabular-nums text-white">{formatPoints(points)}</span>
      <span className="hidden text-[11px] text-white/35 sm:inline">points</span>
    </span>
  )
}

/**
 * The account box: picture and name in one button, and the menu it opens.
 *
 * `variant` decides what the menu offers. On the site it is Profile, Settings,
 * the admin panel for admins, and Sign out. In the panel it is the way back to
 * the site, and Sign out.
 */
export function UserMenu({
  username,
  avatarUrl,
  points,
  isAdmin,
  variant,
}: {
  username: string
  avatarUrl: string | null
  points?: number
  isAdmin?: boolean
  variant: "site" | "admin"
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-2.5 text-[13px] font-medium text-white/85 outline-none transition hover:border-white/[0.16] hover:bg-white/[0.06] data-[state=open]:border-white/[0.18] data-[state=open]:bg-white/[0.07]"
        aria-label="Account menu"
      >
        <Avatar url={avatarUrl} name={username} />
        <span className="hidden max-w-[140px] truncate sm:inline">{username}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/40" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className={MENU_CLASS}>
        <div className="px-2.5 pb-2 pt-1.5">
          <p className="truncate text-[13px] font-semibold text-white">{username}</p>
          {variant === "site" ? (
            <p className="mt-0.5 flex items-center justify-between text-[12px] text-white/40">
              Points
              <span className="font-semibold tabular-nums" style={{ color: ACCENTS.amber }}>
                {formatPoints(points ?? 0)}
              </span>
            </p>
          ) : (
            <MonoLabel className="mt-1 block text-white/30">Admin</MonoLabel>
          )}
        </div>
        <DropdownMenuSeparator className="my-1 bg-white/[0.08]" />

        {variant === "site" ? (
          <>
            <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
              <Link href="/profile">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
              <Link href="/profile?tab=settings">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            {/* A frame later, so the menu has finished closing (and handing focus
                back to its trigger) before the dialog takes focus. */}
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => requestAnimationFrame(() => openRedeem())}>
              <TicketCheck className="h-4 w-4" /> Redeem Code
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
                <Link href={adminUrl()}>
                  <LayoutDashboard className="h-4 w-4" /> Admin panel
                </Link>
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
            {/* The main site by name: on admin.trinidorewards.com "/" is the dashboard. */}
            <Link href={siteHref("/")}>
              <LayoutDashboard className="h-4 w-4" /> Back to site
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1 bg-white/[0.08]" />
        <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Read state kept in the browser, only while the account cannot hold it
 * (before scripts/086). Same shape as the account's: a moment for "all", ids
 * for single reads.
 */
const LOCAL_KEY = "tr-notifications-read"
/** The bell's old "last opened" timestamp, from before read state existed. */
const OLD_SEEN_KEY = "tr-notifications-seen-at"

type LocalReads = { before: number; ids: string[] }

function readLocal(): LocalReads {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "null") as LocalReads | null
    return parsed && Array.isArray(parsed.ids) ? parsed : { before: 0, ids: [] }
  } catch {
    return { before: 0, ids: [] }
  }
}

function writeLocal(value: LocalReads) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ before: value.before, ids: value.ids.slice(-100) }))
  } catch {
    // Private windows can refuse storage; the dots then just come back on reload.
  }
}

const KIND_ICON = {
  raffle_won: { icon: Trophy, accent: ACCENTS.green },
  redemption_submitted: { icon: Package, accent: ACCENTS.pink },
  redemption_confirmed: { icon: PackageCheck, accent: ACCENTS.green },
} as const

function ago(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/**
 * The bell: a raffle won, a store purchase submitted or confirmed.
 *
 * Read means read: selecting a notification marks that one, "Mark all as
 * read" marks the rest, and nothing else does — opening or closing the menu
 * used to mark everything, and every row was a link that left the page.
 * Rows are not links any more; the menu stays open while you work through it.
 */
export function NotificationBell() {
  const [items, setItems] = useState<SiteNotification[]>([])
  const [loaded, setLoaded] = useState(false)
  /** False until the account can store read state (scripts/086); the browser keeps it meanwhile. */
  const [stored, setStored] = useState(true)
  /** Marked here before the server confirms, so a click shows at once. */
  const [justRead, setJustRead] = useState<Set<string>>(() => new Set())
  const [allReadAt, setAllReadAt] = useState(0)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { notifications?: SiteNotification[]; stored?: boolean }
      setItems(data.notifications ?? [])
      setStored(data.stored !== false)
    } catch {
      // The bell staying as it was is the right failure.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.removeItem(OLD_SEEN_KEY)
    } catch {
      // Nothing to clean up, or storage is refused.
    }
    void load()
    // Often enough to catch a confirmation during a session, rarely enough to
    // be nothing to the server.
    const poll = setInterval(() => void load(), 60_000)
    return () => clearInterval(poll)
  }, [load])

  const local = stored ? null : readLocal()
  const isRead = (item: SiteNotification) =>
    item.read ||
    justRead.has(item.id) ||
    Date.parse(item.at) <= allReadAt ||
    (local !== null && (Date.parse(item.at) <= local.before || local.ids.includes(item.id)))

  const unread = items.filter((item) => !isRead(item)).length

  async function markRead(item: SiteNotification) {
    if (isRead(item)) return
    setJustRead((current) => new Set(current).add(item.id))
    if (!stored) {
      const current = readLocal()
      writeLocal({ before: current.before, ids: [...current.ids, item.id] })
      return
    }
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id: item.id }),
    }).catch(() => null)
  }

  async function markAllRead() {
    const now = Date.now()
    setAllReadAt(now)
    if (!stored) {
      writeLocal({ before: now, ids: [] })
      return
    }
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    }).catch(() => null)
  }

  return (
    <DropdownMenu modal={false} onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 outline-none transition hover:border-white/[0.16] hover:text-white data-[state=open]:border-white/[0.18] data-[state=open]:text-white"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: ACCENTS.red }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className={`${MENU_CLASS} w-[340px] p-0`}>
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-white">
            Notifications
            {unread > 0 && <span className="ml-1.5 text-white/40">{unread}</span>}
          </span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold transition hover:bg-white/[0.06]"
              style={{ color: ACCENTS.blue }}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          ) : items.length > 0 ? (
            <MonoLabel className="text-white/30">All read</MonoLabel>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12px] text-white/35">
            {loaded ? "Nothing yet. Raffle wins and store purchases show up here." : "Loading…"}
          </p>
        ) : (
          <div className="max-h-[380px] overflow-y-auto p-1">
            {items.map((item) => {
              const { icon: Icon, accent } = KIND_ICON[item.kind]
              const read = isRead(item)
              return (
                <DropdownMenuItem
                  key={item.id}
                  // Selecting marks it read and keeps the menu open.
                  onSelect={(event) => {
                    event.preventDefault()
                    void markRead(item)
                  }}
                  title={read ? undefined : "Mark as read"}
                  className={`${MENU_ITEM_CLASS} group/item items-start ${read ? "cursor-default opacity-55" : ""}`}
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${accent}1f` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-white">
                      {item.title}
                      {!read && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ACCENTS.blue }} />}
                    </span>
                    <span className="block truncate text-[12px] text-white/45">{item.body}</span>
                    <span className="mt-0.5 block text-[11px] text-white/30">{ago(item.at)}</span>
                  </span>
                  {!read && (
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.10] text-white/40 transition group-hover/item:border-white/25 group-hover/item:text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
