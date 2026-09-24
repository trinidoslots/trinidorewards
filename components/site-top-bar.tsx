"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"
import { BrandWordmark } from "@/components/brand-wordmark"
import { LoginModal } from "@/components/login-modal"
import { NotificationBell, PointsPill, UserMenu } from "@/components/top-bar-parts"
import { useSiteSession } from "@/hooks/use-site-session"

/** Height of the bar. The page wrapper pads by the same amount. */
export const TOP_BAR_HEIGHT = 56

/** Asks MainNav to open its drawer; the button lives here now, the drawer there. */
export const OPEN_MAIN_NAV_EVENT = "main-nav:open"

/**
 * The site's top bar: the logo on the left, your points in the middle, the
 * bell and your account on the right.
 *
 * The account used to sit at the bottom of the left nav and the logo at its
 * top; both moved here, so the nav is only navigation.
 */
export function SiteTopBar() {
  const { user, loading } = useSiteSession()
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <>
      {/* Starts where the left nav ends (its width is published as
          --main-nav-width, collapsed or not), so the nav runs the full height
          beside it instead of being cut off under it. */}
      <header
        className="fixed left-0 right-0 top-0 z-40 flex items-center gap-3 border-b border-white/[0.08] bg-[#0B0B0D]/95 px-3 backdrop-blur transition-[left] duration-300 ease-in-out md:left-[var(--main-nav-width,224px)] md:px-5"
        style={{ height: TOP_BAR_HEIGHT }}
      >
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => window.dispatchEvent(new Event(OPEN_MAIN_NAV_EVENT))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/[0.06] hover:text-white md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" aria-label="TrinidoRewards home" className="flex shrink-0 items-center">
          <BrandMark className="h-7 w-7 sm:hidden" />
          <BrandWordmark className="hidden h-[18px] w-auto sm:block" />
        </Link>

        {/* Centred on the bar, not on the space left between the two sides,
            so it sits in the same place whatever width the name has. */}
        {user && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <Link href="/store" className="pointer-events-auto" aria-label={`${user.points_balance} points, open the store`}>
              <PointsPill points={user.points_balance} />
            </Link>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {/* Below md the centre is too narrow for the pill, so it joins the right. */}
              <span className="md:hidden">
                <PointsPill points={user.points_balance} />
              </span>
              <NotificationBell />
              <UserMenu
                variant="site"
                username={user.username}
                avatarUrl={user.avatar_url}
                points={user.points_balance}
                isAdmin={user.is_admin}
              />
            </>
          ) : (
            !loading && (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="flex h-9 items-center rounded-lg border border-white/12 bg-white/[0.06] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12]"
              >
                Log in
              </button>
            )
          )}
        </div>
      </header>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
