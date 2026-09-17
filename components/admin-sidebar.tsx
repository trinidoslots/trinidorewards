"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
  Gift,
  Home,
  Puzzle,
  Settings,
  Shuffle,
  ShoppingBag,
  Swords,
  Ticket,
  Trophy,
  Tv,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MonoLabel } from "@/components/ui/panel"

type Leaf = { href: string; label: string }
type Item =
  | { kind: "link"; href: string; label: string; icon: typeof Home }
  | { kind: "group"; id: string; label: string; icon: typeof Home; match: string; children: Leaf[] }

// One flat description of the whole nav. Groups used to be four near-identical
// blocks of JSX; expressing them as data means adding "Hunt" is one entry.
const NAV: Item[] = [
  { kind: "link", href: "/admin", label: "Overview", icon: Home },
  {
    kind: "group",
    id: "hunt",
    label: "Hunt",
    icon: Crosshair,
    match: "/admin/bonushunt|/admin/slots|/admin/history|/admin/hunt-source",
    children: [
      { href: "/admin/bonushunt", label: "Bonushunt" },
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
    match: "/admin/users|/admin/wins",
    children: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/wins", label: "Winner Logs" },
    ],
  },
  { kind: "link", href: "/admin/predictions", label: "Predictions", icon: Trophy },
  { kind: "link", href: "/admin/giveaway", label: "Kick Giveaway", icon: Gift },
  { kind: "link", href: "/admin/bonuses", label: "Bonuses", icon: Gift },
  { kind: "link", href: "/admin/random", label: "Random", icon: Shuffle },
  { kind: "link", href: "/admin/advent-calendar", label: "Advent Calendar", icon: Calendar },
  { kind: "link", href: "/admin/tournaments", label: "Tournaments", icon: Swords },
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
    ],
  },
  {
    kind: "group",
    id: "obs",
    label: "OBS Widgets",
    icon: Tv,
    match: "/admin/obs",
    children: [{ href: "/admin/obs/widget-settings", label: "Widget Settings" }],
  },
  { kind: "link", href: "/admin/modules", label: "Modules", icon: Puzzle },
  { kind: "link", href: "/admin/extension", label: "Extension", icon: Database },
  { kind: "link", href: "/admin/settings", label: "Settings", icon: Settings },
]

export default function AdminSidebar({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      NAV.filter((item): item is Extract<Item, { kind: "group" }> => item.kind === "group").map((group) => [
        group.id,
        new RegExp(`^(${group.match})`).test(pathname),
      ]),
    ),
  )

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
            <MonoLabel className="text-white/70">Admin</MonoLabel>
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
        {NAV.map((item) => {
          const Icon = item.icon

          if (item.kind === "link") {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
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
              </Link>
            )
          }

          const groupActive = new RegExp(`^(${item.match})`).test(pathname)
          const expanded = collapsed ? false : (open[item.id] ?? false)

          return (
            <div key={item.id}>
              <button
                onClick={() => setOpen((current) => ({ ...current, [item.id]: !current[item.id] }))}
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
                      className={cn("ml-auto h-3 w-3 transition-transform", expanded && "rotate-180")}
                    />
                  </>
                )}
              </button>

              {expanded && (
                <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-2.5">
                  {item.children.map((child) => {
                    const active = pathname === child.href
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block rounded-md px-2.5 py-1.5 text-[12px] transition",
                          active ? "bg-white/[0.07] text-white" : "text-white/40 hover:bg-white/[0.04] hover:text-white/75",
                        )}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.08] p-2">
        <Link
          href="/"
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
