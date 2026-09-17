"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Home,
  Plus,
  Settings,
  Database,
  History,
  Shuffle,
  Trophy,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Gift,
  Ticket,
  Swords,
  Users,
  ChevronDown,
  Circle,
  Calendar,
  Monitor,
  Radio,
  Puzzle,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminSidebar({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [storeExpanded, setStoreExpanded] = useState(pathname.startsWith("/admin/store"))
  const [rafflesExpanded, setRafflesExpanded] = useState(pathname.startsWith("/admin/raffles"))
  const [leaderboardsExpanded, setLeaderboardsExpanded] = useState(pathname.startsWith("/admin/leaderboards"))
  const [obsExpanded, setObsExpanded] = useState(pathname.startsWith("/admin/obs"))

  const navItems = [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/bonushunt", label: "Bonushunt", icon: Plus },
    { href: "/admin/hunt-source", label: "Hunt Source", icon: Radio },
    { href: "/admin/predictions", label: "Predictions", icon: Trophy },
    { href: "/admin/extension", label: "Extension", icon: Puzzle },
    { href: "/admin/giveaway", label: "Kick Giveaway", icon: Gift },
    { href: "/admin/modules", label: "Modules", icon: Settings },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/slots", label: "Edit Slots", icon: Database },
    { href: "/admin/history", label: "History", icon: History },
    { href: "/admin/random", label: "Random", icon: Shuffle },
    { href: "/admin/bonuses", label: "Bonuses", icon: Gift },
    { href: "/admin/advent-calendar", label: "Advent Calendar", icon: Calendar },
    { href: "/admin/tournaments", label: "Tournaments", icon: Swords },
  ]

  const storeSubItems = [
    { href: "/admin/store", label: "Items" },
    { href: "/admin/store/redemptions", label: "Redemptions" },
  ]

  const rafflesSubItems = [
    { href: "/admin/raffles/create", label: "Create Raffles" },
    { href: "/admin/raffles/active", label: "Active Raffles" },
    { href: "/admin/raffles/history", label: "History" },
    { href: "/admin/raffles/draw", label: "Draw Raffles" },
  ]

  const leaderboardsSubItems = [
    { href: "/admin/leaderboards/overview", label: "Overview" },
    { href: "/admin/leaderboards/manage", label: "Manage" },
  ]

  const handleToggle = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    onCollapse?.(newCollapsed)
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-700/50 transition-all duration-300 ease-in-out z-50",
        collapsed ? "w-14" : "w-56",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm">BonusHunt</span>
          </div>
        )}
        <button
          onClick={handleToggle}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="absolute top-[57px] bottom-[57px] left-0 right-0 overflow-y-auto p-2 space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
                collapsed && "justify-center",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </Link>
          )
        })}

        <div>
          <button
            onClick={() => setLeaderboardsExpanded(!leaderboardsExpanded)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              pathname.startsWith("/admin/leaderboards")
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
              collapsed && "justify-center",
            )}
            title={collapsed ? "Leaderboards" : undefined}
          >
            <Trophy className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Leaderboards</span>}
            {!collapsed && (
              <ChevronDown
                className={cn(
                  "w-3 h-3 ml-auto transition-transform duration-200",
                  leaderboardsExpanded && "rotate-180",
                )}
              />
            )}
          </button>

          {!collapsed && leaderboardsExpanded && (
            <div className="mt-1 space-y-1 ml-3 pl-3 border-l border-slate-700/50">
              {leaderboardsSubItems.map((subItem) => {
                const isActive = pathname === subItem.href
                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <Circle className="w-2 h-2 flex-shrink-0" />
                    <span>{subItem.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setRafflesExpanded(!rafflesExpanded)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              pathname.startsWith("/admin/raffles")
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
              collapsed && "justify-center",
            )}
            title={collapsed ? "Raffles" : undefined}
          >
            <Ticket className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Raffles</span>}
            {!collapsed && (
              <ChevronDown
                className={cn("w-3 h-3 ml-auto transition-transform duration-200", rafflesExpanded && "rotate-180")}
              />
            )}
          </button>

          {!collapsed && rafflesExpanded && (
            <div className="mt-1 space-y-1 ml-3 pl-3 border-l border-slate-700/50">
              {rafflesSubItems.map((subItem) => {
                const isActive = pathname === subItem.href
                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <Circle className="w-2 h-2 flex-shrink-0" />
                    <span>{subItem.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setStoreExpanded(!storeExpanded)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              pathname.startsWith("/admin/store")
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
              collapsed && "justify-center",
            )}
            title={collapsed ? "Stream Store" : undefined}
          >
            <ShoppingBag className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Stream Store</span>}
            {!collapsed && (
              <ChevronDown
                className={cn("w-3 h-3 ml-auto transition-transform duration-200", storeExpanded && "rotate-180")}
              />
            )}
          </button>

          {!collapsed && storeExpanded && (
            <div className="mt-1 space-y-1 ml-3 pl-3 border-l border-slate-700/50">
              {storeSubItems.map((subItem) => {
                const isActive = pathname === subItem.href
                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    )}
                  >
                    <Circle className="w-2 h-2 flex-shrink-0" />
                    <span>{subItem.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setObsExpanded(!obsExpanded)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              pathname.startsWith("/admin/obs")
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
              collapsed && "justify-center",
            )}
            title={collapsed ? "OBS Widgets" : undefined}
          >
            <Monitor className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>OBS Widgets</span>}
            {!collapsed && (
              <ChevronDown
                className={cn("w-3 h-3 ml-auto transition-transform duration-200", obsExpanded && "rotate-180")}
              />
            )}
          </button>

          {!collapsed && obsExpanded && (
            <div className="mt-1 space-y-1 ml-3 pl-3 border-l border-slate-700/50">
              <Link
                href="/admin/obs/widget-settings"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  pathname === "/admin/obs/widget-settings"
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                <Circle className="w-2 h-2 flex-shrink-0" />
                <span>Widget Settings</span>
              </Link>
            </div>
          )}
        </div>

      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-slate-700/50">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200",
            collapsed && "justify-center",
          )}
          title={collapsed ? "Back to Home" : undefined}
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Back to Home</span>}
        </Link>
      </div>
    </aside>
  )
}
