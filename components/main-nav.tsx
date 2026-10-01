"use client"

import Link from "next/link"
import type React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import {
  ChevronDown,
  Gift,
  Grid2X2,
  Home,
  Landmark,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Target,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { OPEN_MAIN_NAV_EVENT } from "@/components/site-top-bar"
import { MonoLabel } from "@/components/ui/panel"
import {
  MODULE_LINKS,
  navGroups,
  type ModuleKey,
  type ModuleRow,
} from "@/lib/site-modules"

/**
 * How each module is drawn. Which group it lands in is not here any more —
 * that comes from the module's own category, through navGroups, so the
 * dropdown in the admin panel actually moves the link.
 */
const MODULE_ICONS: Record<ModuleKey, typeof Gift> = {
  stream_store: Landmark,
  schedule: Radio,
  bonuses: Gift,
  advent_calendar: Grid2X2,
  bonus_hunt: Gift,
  leaderboard: Trophy,
  raffles: WalletCards,
  tournaments: Trophy,
  challenges: Target,
}

const GROUP_ICONS: Record<string, typeof Gift> = {
  stream: Radio,
  bonuses: Gift,
  community: Users,
}

const ACCENT = "#5B8DEF"

/**
 * Where the collapsed state is kept. app/layout.tsx reads the same key in an
 * inline script and sets <html data-nav="collapsed"> before the first paint,
 * so a collapsed nav does not load expanded and then snap shut.
 */
export const NAV_STORAGE_KEY = "main-nav"

/**
 * The left navigation.
 *
 * Collapsing is driven by CSS, off <html data-nav> (see globals.css): the
 * width comes from --main-nav-width, labels fade with .nav-fade, group headers
 * become hairlines with .nav-rule. Nothing changes position when it collapses —
 * every icon sits in the same 40px cell at the same left offset in both states,
 * and group headers keep their height — so the only thing that moves is the
 * right-hand edge. The old version re-centred the icons and swapped headers
 * for dividers of a different height, which made everything jump sideways and
 * up, and carried the toggle button out from under the cursor.
 */
export function MainNav() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([])

  // The inline script has already decided; this only brings React in line so
  // the button and the tooltips know which state they are in.
  useEffect(() => {
    setCollapsed(document.documentElement.dataset.nav === "collapsed")
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    if (next) document.documentElement.dataset.nav = "collapsed"
    else delete document.documentElement.dataset.nav
    try {
      localStorage.setItem(NAV_STORAGE_KEY, next ? "collapsed" : "expanded")
    } catch {
      // Private mode or blocked storage: the nav still toggles, it just will
      // not be remembered.
    }
  }

  // The drawer's button is in the top bar now; it asks for the drawer by event.
  useEffect(() => {
    const open = () => setMobileOpen(true)
    window.addEventListener(OPEN_MAIN_NAV_EVENT, open)
    return () => window.removeEventListener(OPEN_MAIN_NAV_EVENT, open)
  }, [])

  useEffect(() => {
    createClient()
      .from("modules")
      // The row, not two columns: category is what decides the group now, and
      // it arrived with a migration the deploy does not wait for.
      .select("*")
      .then(({ data }) => setModuleRows((data ?? []) as ModuleRow[]), () => {})
  }, [])

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/auth")) return null

  const close = () => setMobileOpen(false)

  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      {/* Full height, with the top bar starting at its right edge rather than
          running over it. The logo and the account live in the top bar. */}
      <aside
        className={`nav-shell fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col overflow-x-hidden border-r border-white/[0.08] bg-[#0B0B0D] md:w-[var(--main-nav-width)] md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* The toggle, level with the top bar. It sits in the same cell as
            the icons below it, so it never moves. */}
        <div className="flex h-14 shrink-0 items-center border-b border-white/[0.08] px-3">
          <NavTip label={collapsed ? "Expand" : "Collapse"} enabled>
            <button
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed}
              onClick={toggleCollapsed}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/[0.06] hover:text-white md:flex"
            >
              {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            </button>
          </NavTip>
          <button
            aria-label="Close navigation"
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/50 transition hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <NavItem href="/" label="Home" icon={Home} active={pathname === "/"} collapsed={collapsed} onNavigate={close} />

          {navGroups(moduleRows).map((group) => {
            // A collapsed nav has no headers to click, so every group shows.
            const open = collapsed || (openGroups[group.label] ?? true)
            const GroupIcon = GROUP_ICONS[group.id] ?? Users

            return (
              <div key={group.label} className="mt-4">
                <div className="relative flex h-8 items-center">
                  {/* Collapsed, the header becomes this hairline in the same
                      space, so the rows under it stay where they are. */}
                  <span aria-hidden className="nav-rule absolute inset-x-2 top-1/2 h-px bg-white/[0.10]" />
                  <button
                    onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !open }))}
                    aria-expanded={open}
                    tabIndex={collapsed ? -1 : 0}
                    className="nav-fade flex w-full items-center justify-between whitespace-nowrap rounded-md px-3 text-white/30 transition-colors hover:text-white/60"
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon className="h-3 w-3" />
                      <MonoLabel>{group.label}</MonoLabel>
                    </span>
                    <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0 space-y-0.5 overflow-hidden pt-0.5">
                    {group.keys.map((key: ModuleKey) => {
                      const { label, href } = MODULE_LINKS[key]
                      return (
                        <NavItem
                          key={key}
                          href={href}
                          label={label}
                          icon={MODULE_ICONS[key]}
                          active={pathname === href}
                          collapsed={collapsed}
                          onNavigate={close}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>
      </aside>

      {/* The drawer's backdrop. Always mounted so it can fade both ways. */}
      <button
        aria-label="Close navigation overlay"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
    </TooltipPrimitive.Provider>
  )
}

/**
 * One link. The icon lives in a fixed 40px cell and the label after it; the
 * row is never re-laid out between states, only clipped by the nav's width.
 */
function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string
  label: string
  icon: typeof Gift
  active: boolean
  collapsed: boolean
  onNavigate: () => void
}) {
  return (
    <NavTip label={label} enabled={collapsed}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-10 items-center rounded-lg text-[13.5px] transition-colors ${
          active ? "bg-white/[0.07] text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white/85"
        }`}
      >
        {/* The active marker sits on the nav's own left edge, the same place
            in both states. */}
        <span
          aria-hidden
          className={`absolute -left-3 top-2.5 bottom-2.5 w-[3px] rounded-r-full transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
          style={{ backgroundColor: ACCENT }}
        />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="nav-fade truncate whitespace-nowrap pr-3">{label}</span>
      </Link>
    </NavTip>
  )
}

/** The name beside an icon, for a collapsed nav. Portalled, so the nav's clipping does not cut it off. */
function NavTip({ label, enabled, children }: { label: string; enabled: boolean; children: React.ReactElement }) {
  return (
    <TooltipPrimitive.Root open={enabled ? undefined : false}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={14}
          className="z-[60] rounded-md border border-white/10 bg-[#16161A] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] animate-in fade-in-0 slide-in-from-left-1"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
