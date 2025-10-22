"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Plus, Settings, Database, History, Shuffle, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/admin", label: "Add Bonus", icon: Plus },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/slots", label: "Edit Slots", icon: Database },
    { href: "/admin/history", label: "History", icon: History },
    { href: "/admin/random", label: "Random", icon: Shuffle },
    { href: "/admin/leaderboards", label: "Leaderboards", icon: Trophy },
  ]

  return (
    <nav className="flex gap-1.5 mb-3 overflow-x-auto pb-1 hide-scrollbar">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-cyan-600 text-white"
                : "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white border border-slate-700/50",
            )}
          >
            <Icon className="w-3 h-3" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
