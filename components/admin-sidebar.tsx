"use client"

import { adminHref } from "@/lib/admin-host"
import { useAdminPathname } from "@/lib/use-admin-pathname"
import Link from "next/link"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Bot,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
  Eye,
  Gift,
  Home,
  MessageCircle,
  Puzzle,
  Settings,
  Shuffle,
  ShoppingBag,
  Swords,
  Target,
  Ticket,
  TicketCheck,
  Trophy,
  Tv,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { accessFor, type StaffRole } from "@/lib/admin-permissions"
import { MonoLabel } from "@/components/ui/panel"
import { siteHref } from "@/lib/site-url"

export type Leaf = { href: string; label: string }
export type Item =
  | { kind: "link"; href: string; label: string; icon: typeof Home }
  | { kind: "group"; id: string; label: string; icon: typeof Home; match: string; children: Leaf[] }

// One flat description of the whole nav. Groups used to be four near-identical
// blocks of JSX; expressing them as data means adding "Hunt" is one entry.
export const NAV: Item[] = [
  { kind: "link", href: "/admin", label: "Overview", icon: Home },
  {
    kind: "group",
    id: "hunt",
    label: "Hunt",
    icon: Crosshair,
    match: "/admin/bonushunt|/admin/slots|/admin/history|/admin/hunt-source",
    children: [
      { href: "/admin/bonushunt", label: "Bonushunt" },
      { href: "/admin/bonushunt/opening", label: "Opening Mode" },
      { href: "/admin/slots", label: "Edit Slots" },
      { href: "/admin/history", label: "History" },
      { href: "/admin/hunt-source", label: "Hunt Source" },
    ],
  },
  {
    kind: "group",
    id: "users",
    label: "Users",
    icon: Users,
    match: "/admin/users|/admin/wins|/admin/points",
    children: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/points", label: "Points" },
      { href: "/admin/wins", label: "Winner Logs" },
    ],
  },
  { kind: "link", href: "/admin/schedule", label: "Schedule", icon: CalendarDays },
  { kind: "link", href: "/admin/predictions", label: "Predictions", icon: Trophy },
  { kind: "link", href: "/admin/giveaway", label: "Kick Giveaway", icon: Gift },
  { kind: "link", href: "/admin/bonuses", label: "Bonuses", icon: Gift },
  { kind: "link", href: "/admin/random", label: "Random", icon: Shuffle },
  { kind: "link", href: "/admin/advent-calendar", label: "Advent Calendar", icon: Calendar },
  { kind: "link", href: "/admin/tournaments", label: "Tournaments", icon: Swords },
  {
    kind: "group",
    id: "challenges",
    label: "Challenges",
    icon: Target,
    match: "/admin/challenges",
    children: [
      { href: "/admin/challenges", label: "Challenges" },
      { href: "/admin/challenges/submissions", label: "Submissions" },
    ],
  },
  {
    kind: "group",
    id: "store",
    label: "Store",
    icon: ShoppingBag,
    match: "/admin/store",
    children: [
      { href: "/admin/store", label: "Items" },
      { href: "/admin/store/redemptions", label: "Redemptions" },
    ],
  },
  { kind: "link", href: "/admin/promo-codes", label: "Promo Codes", icon: TicketCheck },
  {
    kind: "group",
    id: "raffles",
    label: "Raffles",
    icon: Ticket,
    match: "/admin/raffles",
    children: [
      { href: "/admin/raffles/create", label: "Create" },
      { href: "/admin/raffles/active", label: "Active" },
      { href: "/admin/raffles/history", label: "History" },
      { href: "/admin/raffles/draw", label: "Draw" },
    ],
  },
  {
    kind: "group",
    id: "leaderboards",
    label: "Leaderboards",
    icon: Trophy,
    match: "/admin/leaderboards",
    children: [
      { href: "/admin/leaderboards/overview", label: "Overview" },
      { href: "/admin/leaderboards/manage", label: "Manage" },
      { href: "/admin/leaderboards/providers", label: "Feeds" },
    ],
  },
  {
    kind: "group",
    id: "obs",
    label: "OBS Widgets",
    icon: Tv,
    match: "/admin/obs",
    children: [
      { href: "/admin/obs/widget-settings", label: "Widget Settings" },
      { href: "/admin/obs/starting-soon", label: "Starting Soon" },
      { href: "/admin/obs/now-playing", label: "Now Playing" },
    ],
  },
  { kind: "link", href: "/admin/discord", label: "Discord", icon: MessageCircle },
  { kind: "link", href: "/admin/kick-bot", label: "Kick Bot", icon: Bot },
  { kind: "link", href: "/admin/modules", label: "Modules", icon: Puzzle },
  { kind: "link", href: "/admin/extension", label: "Extension", icon: Database },
  { kind: "link", href: "/admin/settings", label: "Settings", icon: Settings },
]

/**
 * The nav a role gets: items it cannot open are dropped, and a group keeps
 * only the children it can open (or goes, if none are left).
 */
export function navFor(role: StaffRole): Item[] {
  if (role === "admin") return NAV
  return NAV.flatMap((item): Item[] => {
    if (item.kind === "link") return accessFor(role, item.href) ? [item] : []
    const children = item.children.filter((child) => accessFor(role, child.href))
    return children.length ? [{ ...item, children }] : []
  })
}

export default function AdminSidebar({
  onCollapse,
  role = "admin",
}: {
  onCollapse?: (collapsed: boolean) => void
  role?: StaffRole
}) {
  const pathname = useAdminPathname()
  const nav = navFor(role)
  const viewOnly = (href: string) => accessFor(role, href) === "view"
  const [collapsed, setCollapsed] = useState(false)
  // One group open at a time, like an accordion: opening a group closes the
  // one that was open. It starts on the group of the current page.
  const groupFor = (path: string) =>
    nav.find(
      (item): item is Extract<Item, { kind: "group" }> =>
        item.kind === "group" && new RegExp(`^(${item.match})`).test(path),
    )?.id ?? null
  const [openGroup, setOpenGroup] = useState<string | null>(() => groupFor(pathname))

  // Arriving on a page in another group (a link inside a page, the back
  // button) opens that group, so the current page is always visible in the nav.
  useEffect(() => {
    const group = groupFor(pathname)
    if (group) setOpenGroup(group)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav only changes with role
  }, [pathname])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    onCollapse?.(next)
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen border-r border-white/[0.08] bg-[#0B0B0D] transition-all duration-300 ease-in-out",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-white/[0.08] px-3">
        {!collapsed && (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-[#5B8DEF]" />
            <MonoLabel className="text-white/70">{role === "moderator" ? "Moderator" : "Admin"}</MonoLabel>
          </>
        )}
        <button
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto rounded p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="absolute inset-x-0 bottom-14 top-14 space-y-0.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.map((item) => {
          const Icon = item.icon

          if (item.kind === "link") {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={adminHref(item.href)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition",
                  active ? "bg-white/[0.07] text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80",
                  collapsed && "justify-center",
                )}
              >
                <span
                  className={cn("h-3.5 w-[2px] shrink-0 rounded-full", active ? "bg-[#5B8DEF]" : "bg-transparent")}
                />
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && viewOnly(item.href) && <Eye className="ml-auto h-3 w-3 shrink-0 text-white/25" />}
              </Link>
            )
          }

          const groupActive = new RegExp(`^(${item.match})`).test(pathname)
          const expanded = !collapsed && openGroup === item.id

          return (
            <div key={item.id}>
              <button
                onClick={() => setOpenGroup((current) => (current === item.id ? null : item.id))}
                aria-expanded={expanded}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition",
                  groupActive ? "text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80",
                  collapsed && "justify-center",
                )}
              >
                <span
                  className={cn(
                    "h-3.5 w-[2px] shrink-0 rounded-full",
                    groupActive ? "bg-[#5B8DEF]" : "bg-transparent",
                  )}
                />
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    <ChevronDown
                      className={cn("ml-auto h-3 w-3 transition-transform duration-300", expanded && "rotate-180")}
                    />
                  </>
                )}
              </button>

              {/* Height and opacity ease together, so the groups below slide
                  instead of jumping when one closes and another opens. */}
              <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="children"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                >
                <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-2.5">
                  {item.children.map((child) => {
                    const active = pathname === child.href
                    return (
                      <Link
                        key={child.href}
                        href={adminHref(child.href)}
                        className={cn(
                          "flex items-center rounded-md px-2.5 py-1.5 text-[12px] transition",
                          active ? "bg-white/[0.07] text-white" : "text-white/40 hover:bg-white/[0.04] hover:text-white/75",
                        )}
                      >
                        {child.label}
                        {viewOnly(child.href) && <Eye className="ml-auto h-3 w-3 shrink-0 text-white/25" />}
                      </Link>
                    )
                  })}
                </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.08] p-2">
        <Link
          href={siteHref("/")}
          title={collapsed ? "Back to site" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-white/40 transition hover:bg-white/[0.04] hover:text-white/80",
            collapsed && "justify-center",
          )}
        >
          <Home className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Back to site</span>}
        </Link>
      </div>
    </aside>
  )
}
