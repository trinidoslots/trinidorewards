"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronLeft, Gift, Grid2X2, Home, Landmark, Lock, Menu, Radio, Trophy, Users, WalletCards, X } from "lucide-react"
import { LoginModal } from "./login-modal"
import { createClient } from "@/lib/supabase/client"

interface ModuleStatus {
  stream_store: boolean
  bonus_hunt: boolean
  raffles: boolean
  schedule: boolean
  tournaments: boolean
  leaderboard: boolean
  claim_bonuses: boolean
  active_bonuses: boolean
  advent_calendar: boolean
}

const emptyModules: ModuleStatus = { stream_store: false, bonus_hunt: false, raffles: false, schedule: false, tournaments: false, leaderboard: false, claim_bonuses: false, active_bonuses: false, advent_calendar: false }

const groups = [
  { label: "Stream", icon: Radio, items: [{ label: "Stream Store", href: "/store", icon: Landmark, key: "stream_store" as const }, { label: "Schedule", href: "/schedule", icon: Radio, key: "schedule" as const }] },
  { label: "Bonuses", icon: Gift, items: [{ label: "Bonus Hunts", href: "/bonushunt", icon: Gift, key: "bonus_hunt" as const }, { label: "Active Bonuses", href: "/bonuses/active", icon: Gift, key: "active_bonuses" as const }, { label: "Claim Bonuses", href: "/bonuses/claim", icon: WalletCards, key: "claim_bonuses" as const }, { label: "Advent Calendar", href: "/advent", icon: Grid2X2, key: "advent_calendar" as const }] },
  { label: "Community", icon: Users, items: [{ label: "Leaderboard", href: "/leaderboard", icon: Trophy, key: "leaderboard" as const }, { label: "Raffles", href: "/raffles", icon: WalletCards, key: "raffles" as const }, { label: "Tournaments", href: "/tournaments", icon: Trophy, key: "tournaments" as const }] },
]

export function MainNav() {
  const pathname = usePathname()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Stream: true, Bonuses: true, Community: true })
  const [loginOpen, setLoginOpen] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [points, setPoints] = useState(0)
  const [modules, setModules] = useState<ModuleStatus>(emptyModules)
  const [modulesLoaded, setModulesLoaded] = useState(false)
  useEffect(() => {
    document.documentElement.style.setProperty("--main-nav-width", collapsed ? "56px" : "224px")
  }, [collapsed])

  useEffect(() => {
    fetch("/api/auth/session").then(async (res) => { if (res.ok) { const data = await res.json(); setUsername(data.username); setPoints(data.points || 0) } }).catch(() => {})
    supabase.from("modules").select("module_name, is_enabled").then(({ data }) => { const next = { ...emptyModules }; data?.forEach((item) => { const key = item.module_name.toLowerCase() as keyof ModuleStatus; if (key in next) next[key] = item.is_enabled }); setModules(next); setModulesLoaded(true) }, () => setModulesLoaded(true))
  }, [])

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/auth")) return null

  const navGroup = (group: (typeof groups)[number], groupIndex: number) => {
    const open = openGroups[group.label]
    const GroupIcon = group.icon
    const enabledItems = group.items.filter((item) => modules[item.key])
    if (!enabledItems.length) return null
    return <div className={collapsed ? `mt-3 pt-3 ${groupIndex > 0 ? "border-t border-cyan-200/10" : ""}` : "mt-4"}><button onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !open }))} aria-expanded={open} className={`flex w-full items-center rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 transition hover:text-cyan-100 ${collapsed ? "hidden" : "justify-between border border-cyan-200/10 bg-slate-900/60 px-3 py-2 hover:border-cyan-200/20"}`}><span className="flex items-center gap-2"><GroupIcon className="h-3.5 w-3.5 text-cyan-300/70" />{group.label}</span><ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /></button><div className={`${collapsed || open ? "mt-1.5 max-h-[500px] opacity-100" : "max-h-0 opacity-0"} space-y-0.5 overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-in-out`}>{enabledItems.map(({ label, href, icon: ItemIcon }) => <Link key={`${label}-${href}`} href={href} onClick={() => setMobileOpen(false)} aria-label={label} className={`flex items-center rounded-lg text-sm font-medium transition ${collapsed ? "h-9 w-full justify-center px-0" : "gap-3 px-2.5 py-2"} ${pathname === href ? "bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/20" : "text-slate-300 hover:bg-cyan-300/10 hover:text-white"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${collapsed ? "" : "border border-slate-700/70 bg-slate-950/50"}`}><ItemIcon className="h-4 w-4 text-cyan-200/70" /></span>{!collapsed && <span className="truncate">{label}</span>}</Link>)}</div></div>
  }

  return <>
    <button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-40 rounded-lg border border-cyan-200/20 bg-slate-900 p-2 text-cyan-100 md:hidden"><Menu className="h-5 w-5" /></button>
    <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-cyan-200/10 bg-slate-950 transition-all duration-300 ease-in-out ${collapsed ? "w-14" : "w-56"} ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
      <div className={`flex items-center border-b border-cyan-200/10 p-3 ${collapsed ? "justify-center" : "justify-between"}`}>{!collapsed && <Link href="/" className="flex min-w-0 items-center text-cyan-100" aria-label="BonusHunt home"><span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-200/20 bg-cyan-300/10"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Photoroom-KROuRFGCCVXHUzWnmDtLWy44vNgUV8.png" alt="TrinidoSlots mascot" className="h-full w-full object-cover object-top" /></span><span className="ml-2 truncate text-sm font-bold tracking-tight">TrinidoSlots</span></Link>}<button aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed(!collapsed)} className="ml-auto flex h-7 w-7 items-center justify-center rounded text-cyan-100/70 transition hover:bg-cyan-300/10 hover:text-cyan-100"><ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} /></button>{!collapsed && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="ml-1 p-1 text-slate-400 md:hidden"><X className="h-5 w-5" /></button>}</div>
      <nav className={`absolute bottom-[57px] left-0 right-0 top-[57px] overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${collapsed ? "space-y-3" : "space-y-1"}`}><Link href="/" onClick={() => setMobileOpen(false)} aria-label="Home" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${collapsed ? "justify-center" : ""} ${pathname === "/" ? "bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/20" : "text-slate-300 hover:bg-cyan-300/10 hover:text-white"}`}><Home className="h-4 w-4 shrink-0 text-cyan-200/70" />{!collapsed && <span className="truncate">Home</span>}</Link>{groups.map((group, index) => <div key={group.label}>{navGroup(group, index)}</div>)}</nav>
      <div className="absolute bottom-0 left-0 right-0 border-t border-cyan-200/10 p-2">{username ? <Link href="/profile" aria-label="Open profile" className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-300 ${collapsed ? "justify-center" : ""}`}><span className="h-7 w-7 shrink-0 rounded-full bg-cyan-300/30" /><span className={collapsed ? "sr-only" : "truncate"}>{username} · {points.toFixed(0)} pts</span></Link> : <button onClick={() => setLoginOpen(true)} className={`flex h-9 items-center justify-center rounded-lg border border-cyan-200/20 text-sm text-slate-300 transition hover:bg-cyan-300/10 hover:text-cyan-100 ${collapsed ? "w-9 px-0 text-[0px]" : "w-full px-3"}`}><span className={collapsed ? "sr-only" : ""}>{collapsed ? "Login" : "Log in"}</span>{collapsed && <Lock aria-hidden="true" className="h-4 w-4 text-cyan-200" />}</button>}</div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/70 md:hidden" />}
    <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
  </>
}
