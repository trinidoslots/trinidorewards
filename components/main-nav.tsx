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
import { createClient } from "@/lib/supabase/client"
import { MonoLabel } from "@/components/ui/panel"
import { ALL_OFF, readModules, type ModuleStatus } from "@/lib/site-modules"

const groups = [
  {
    label: "Stream",
    icon: Radio,
    items: [
      { label: "Stream Store", href: "/store", icon: Landmark, key: "stream_store" as const },
      { label: "Schedule", href: "/schedule", icon: Radio, key: "schedule" as const },
    ],
  },
  {
    label: "Bonuses",
    icon: Gift,
    items: [
      { label: "Active Bonuses", href: "/bonuses/active", icon: Gift, key: "active_bonuses" as const },
      { label: "Claim Bonuses", href: "/bonuses/claim", icon: WalletCards, key: "claim_bonuses" as const },
      { label: "Advent Calendar", href: "/advent", icon: Grid2X2, key: "advent_calendar" as const },
    ],
  },
  {
    label: "Community",
    icon: Users,
    items: [
      { label: "Bonus Hunts", href: "/bonushunt", icon: Gift, key: "bonus_hunt" as const },
      { label: "Leaderboard", href: "/leaderboard", icon: Trophy, key: "leaderboard" as const },
      { label: "Raffles", href: "/raffles", icon: WalletCards, key: "raffles" as const },
      { label: "Tournaments", href: "/tournaments", icon: Trophy, key: "tournaments" as const },
    ],
  },
]

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
      .select("module_name, is_enabled")
      .then(({ data }) => {
        setModules(readModules(data ?? []))
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
            <Link href="/" className="flex min-w-0 items-center" aria-label="TrinidoSlots home">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.10] bg-white/[0.04]">
                {/* eslint-disable-next-line @next/next/no-img-element -- external blob host */}
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Photoroom-KROuRFGCCVXHUzWnmDtLWy44vNgUV8.png"
                  alt="TrinidoSlots mascot"
                  className="h-full w-full object-cover object-top"
                />
              </span>
              <span className="ml-2 truncate text-[13px] font-semibold tracking-tight text-white">TrinidoSlots</span>
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

          {groups.map((group) => {
            const enabled = group.items.filter((item) => modules[item.key])
            if (!enabled.length) return null

            const open = openGroups[group.label]
            const GroupIcon = group.icon

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
                  {enabled.map(({ label, href, icon: ItemIcon }) => {
                    const active = pathname === href
                    return (
                      <Link
                        key={`${label}-${href}`}
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
