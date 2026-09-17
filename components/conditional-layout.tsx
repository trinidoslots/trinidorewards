"use client"

import type React from "react"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { MainNav } from "@/components/main-nav"
import { Footer } from "@/components/footer"
import { RouteTransitionOverlay } from "@/components/route-transition-overlay"

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isOBSPage =
    pathname === "/predictionobs" || pathname === "/obs-widget" || pathname.startsWith("/obs/")

  // OBS browser sources need a truly transparent page so the stream
  // compositor shows through. The root layout's <body> always carries
  // bg-slate-950, which paints an opaque color behind these widgets, so we
  // strip it here rather than in the (server-only) root layout.
  useEffect(() => {
    document.body.classList.toggle("bg-slate-950", !isOBSPage)
    document.body.classList.toggle("bg-transparent", isOBSPage)
  }, [isOBSPage])

  if (isOBSPage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen transition-[padding-left] duration-300 ease-in-out md:pl-[var(--main-nav-width,238px)]">
      <MainNav />
      <RouteTransitionOverlay>
        <main className="min-h-screen">{children}</main>
        <Footer />
      </RouteTransitionOverlay>
    </div>
  )
}
