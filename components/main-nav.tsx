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
  Lock,
  Menu,
  Radio,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { LoginModal } from "./login-modal"
import { BrandMark } from "@/components/brand-mark"
import { createClient } from "@/lib/supabase/client"
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
  const [loginOpen, setLoginOpen] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [points, setPoints] = useState(0)
  const [modules, setModules] = useState<ModuleStatus>(ALL_OFF)
  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([])

  useEffect(() => {
    document.documentElement.style.setProperty("--main-nav-width", collapsed ? "56px" : "224px")
  }, [collapsed])

  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        setUsername(data.username)
        // The session has always carried this; the nav just never read it and
        // drew a flat coloured disc instead.
        setAvatarUrl(data.avatar_url || null)
        setPoints(data.points || 0)
      })
      .catch(() => {})

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
      <button
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-md border border-white/[0.10] bg-[#0B0B0D] p-2 text-white/70 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.08] bg-[#0B0B0D] transition-all duration-300 ease-in-out ${
          collapsed ? "w-14" : "w-56"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Brand */}
        <div
          className={`flex h-14 items-center border-b border-white/[0.08] px-3 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <Link href="/" className="flex min-w-0 items-center" aria-label="TrinidoRewards home">
              {/* No wrapper: the mark draws its own tile and hairline, and the
                  mascot's frame around it doubled the border. 28px and 8px to
                  the name, as the canvas's navigation artboard has it. */}
              <BrandMark className="h-7 w-7 shrink-0" />
              <span className="ml-2 truncate text-[13px] font-bold tracking-tight text-white">TrinidoRewards</span>
            </Link>
          )}
          <button
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          {!collapsed && (
            <button
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="ml-1 p-1 text-white/30 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="absolute inset-x-0 bottom-14 top-14 space-y-0.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {/* Session */}
        <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.08] p-2">
          {username ? (
            <Link
              href="/profile"
              aria-label="Open profile"
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-[12px] text-white/50 transition hover:bg-white/[0.04] hover:text-white/80 ${
                collapsed ? "justify-center" : ""
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                  // A Kick avatar URL can rot; fall back to the disc rather
                  // than leaving a broken-image glyph in the nav.
                  onError={() => setAvatarUrl(null)}
                />
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-full" style={{ backgroundColor: `${ACCENT}44` }} />
              )}
              <span className={collapsed ? "sr-only" : "truncate"}>
                {username} · {points.toFixed(0)} pts
              </span>
            </Link>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              className={`flex h-9 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.06] font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12] ${
                collapsed ? "w-9 px-0" : "w-full px-3"
              }`}
            >
              {collapsed ? <Lock aria-hidden="true" className="h-4 w-4" /> : "Log in"}
              {collapsed && <span className="sr-only">Log in</span>}
            </button>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
        />
      )}

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
