"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Bell, ChevronDown, Coins, LayoutDashboard, LogOut, Package, PackageCheck, Settings, Trophy, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { signOut } from "@/hooks/use-site-session"
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
            {isAdmin && (
              <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
                <Link href="/admin">
                  <LayoutDashboard className="h-4 w-4" /> Admin panel
                </Link>
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <DropdownMenuItem asChild className={MENU_ITEM_CLASS}>
            <Link href="/">
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

/** Where the bell remembers it was last opened. Per browser, and only a convenience. */
const SEEN_KEY = "tr-notifications-seen-at"

function readSeen(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

function writeSeen(value: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(value))
  } catch {
    // Private windows can refuse storage; the badge then just stays.
  }
}

const KIND_ICON = {
  raffle_won: { icon: Trophy, accent: ACCENTS.purple },
  redemption_submitted: { icon: Package, accent: ACCENTS.amber },
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

/** The bell: a raffle won, a redemption submitted or confirmed. */
export function NotificationBell() {
  const [items, setItems] = useState<SiteNotification[]>([])
  const [seenAt, setSeenAt] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      setItems((data?.notifications ?? []) as SiteNotification[])
    } catch {
      // The bell staying as it was is the right failure.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    setSeenAt(readSeen())
    void load()
    // Often enough to catch a confirmation during a session, rarely enough to
    // be nothing to the server.
    const poll = setInterval(() => void load(), 60_000)
    return () => clearInterval(poll)
  }, [load])

  const unread = items.filter((item) => Date.parse(item.at) > seenAt).length

  const onOpenChange = (open: boolean) => {
    if (open) {
      void load()
      return
    }
    // Marked read on close rather than open, so the dots are still there to
    // see while the menu is up.
    const now = Date.now()
    writeSeen(now)
    setSeenAt(now)
  }

  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 outline-none transition hover:border-white/[0.16] hover:text-white data-[state=open]:border-white/[0.18] data-[state=open]:text-white"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
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

      <DropdownMenuContent align="end" sideOffset={8} className={`${MENU_CLASS} w-[320px] p-0`}>
        <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-white">Notifications</span>
          {unread > 0 && <MonoLabel className="text-white/35">{unread} new</MonoLabel>}
        </div>

        {items.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12px] text-white/35">
            {loaded ? "Nothing yet. Raffle wins and redemptions show up here." : "Loading…"}
          </p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto p-1">
            {items.map((item) => {
              const { icon: Icon, accent } = KIND_ICON[item.kind]
              const fresh = Date.parse(item.at) > seenAt
              return (
                <DropdownMenuItem key={item.id} asChild className={`${MENU_ITEM_CLASS} items-start`}>
                  <Link href={item.href}>
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${accent}1f` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-white">
                        {item.title}
                        {fresh && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENTS.blue }} />}
                      </span>
                      <span className="block truncate text-[12px] text-white/45">{item.body}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-white/30">{ago(item.at)}</span>
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
