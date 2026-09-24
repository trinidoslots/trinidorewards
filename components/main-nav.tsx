"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronLeft,
  Gift,
  Grid2X2,
  Home,
  Landmark,
  Radio,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { OPEN_MAIN_NAV_EVENT } from "@/components/site-top-bar"
import { MonoLabel } from "@/components/ui/panel"
import {
  ALL_OFF,
  MODULE_LINKS,
  navGroups,
  readModules,
  type ModuleKey,
  type ModuleRow,
  type ModuleStatus,
} from "@/lib/site-modules"

/**
 * How each module is drawn. Which group it lands in is not here any more —
 * that comes from the module's own category, through navGroups, so the
 * dropdown in the admin panel actually moves the link.
 */
const MODULE_ICONS: Record<ModuleKey, typeof Gift> = {
  stream_store: Landmark,
  schedule: Radio,
  active_bonuses: Gift,
  claim_bonuses: WalletCards,
  advent_calendar: Grid2X2,
  bonus_hunt: Gift,
  leaderboard: Trophy,
  raffles: WalletCards,
  tournaments: Trophy,
}

const GROUP_ICONS: Record<string, typeof Gift> = {
  stream: Radio,
  bonuses: Gift,
  community: Users,
}

const ACCENT = "#5B8DEF"

export function MainNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Stream: true,
    Bonuses: true,
    Community: true,
  })
  const [modules, setModules] = useState<ModuleStatus>(ALL_OFF)
  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([])

  useEffect(() => {
    document.documentElement.style.setProperty("--main-nav-width", collapsed ? "56px" : "224px")
  }, [collapsed])

  // The drawer's button is in the top bar now; it asks for the drawer by event.
  useEffect(() => {
    const open = () => setMobileOpen(true)
    window.addEventListener(OPEN_MAIN_NAV_EVENT, open)
    return () => window.removeEventListener(OPEN_MAIN_NAV_EVENT, open)
  }, [])

  useEffect(() => {
    supabase
      .from("modules")
      // The row, not two columns: category is what decides the group now, and
      // it arrived with a migration the deploy does not wait for.
      .select("*")
      .then(({ data }) => {
        setModules(readModules(data ?? []))
        setModuleRows((data ?? []) as ModuleRow[])
      }, () => {})
  }, [])

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/auth")) return null

  const itemClass = (active: boolean) =>
    `flex items-center rounded-md text-[13px] transition ${
      collapsed ? "h-9 w-full justify-center px-0" : "gap-2.5 px-2.5 py-2"
    } ${active ? "bg-white/[0.07] text-white" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"}`

  return (
    <>
      {/* Below the top bar, which carries the logo and the account now. */}
      <aside
        className={`fixed bottom-0 left-0 top-14 z-40 flex flex-col border-r border-white/[0.08] bg-[#0B0B0D] transition-all duration-300 ease-in-out ${
          collapsed ? "w-14" : "w-56"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <nav className="absolute inset-x-0 bottom-14 top-0 space-y-0.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            aria-label="Home"
            className={itemClass(pathname === "/")}
          >
            <span className={`h-3.5 w-[2px] shrink-0 rounded-full ${pathname === "/" ? "" : "bg-transparent"}`}
              style={pathname === "/" ? { backgroundColor: ACCENT } : undefined}
            />
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Home</span>}
          </Link>

          {navGroups(moduleRows).map((group) => {
            const open = openGroups[group.label] ?? true
            const GroupIcon = GROUP_ICONS[group.id] ?? Users

            return (
              <div key={group.label} className={collapsed ? "mt-3 border-t border-white/[0.08] pt-3" : "mt-3"}>
                {!collapsed && (
                  <button
                    onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !open }))}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between px-2.5 py-1.5 text-white/30 transition hover:text-white/60"
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon className="h-3 w-3" />
                      <MonoLabel>{group.label}</MonoLabel>
                    </span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                )}

                <div
                  className={`${
                    collapsed || open ? "mt-0.5 max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  } space-y-0.5 overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-in-out`}
                >
                  {group.keys.map((key: ModuleKey) => {
                    const { label, href } = MODULE_LINKS[key]
                    const ItemIcon = MODULE_ICONS[key]
                    const active = pathname === href
                    return (
                      <Link
                        key={key}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        aria-label={label}
                        className={itemClass(active)}
                      >
                        <span
                          className={`h-3.5 w-[2px] shrink-0 rounded-full ${active ? "" : "bg-transparent"}`}
                          style={active ? { backgroundColor: ACCENT } : undefined}
                        />
                        <ItemIcon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{label}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Collapse on desktop, close on mobile. The account that sat here is
            in the top bar now. */}
        <div
          className={`absolute inset-x-0 bottom-0 flex h-14 items-center border-t border-white/[0.08] px-2 ${
            collapsed ? "justify-center" : "justify-end"
          }`}
        >
          <button
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-8 w-8 items-center justify-center rounded text-white/30 transition hover:bg-white/[0.06] hover:text-white md:flex"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded text-white/40 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 top-14 z-30 bg-black/70 md:hidden"
        />
      )}
    </>
  )
}
