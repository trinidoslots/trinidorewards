"use client"

import type React from "react"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { MainNav } from "@/components/main-nav"
import { Footer } from "@/components/footer"
import { AmbientBackground } from "@/components/ambient-background"
import { PageTransition } from "@/components/page-transition"
import { Reveal } from "@/components/reveal"

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isOBSPage =
    pathname === "/predictionobs" || pathname === "/obs-widget" || pathname.startsWith("/obs/")

  // The admin panel and the auth screens bring their own chrome. MainNav and
  // Footer already bow out of both by returning null, but the wrapper below
  // stayed, and with it two things that did not belong:
  //
  //  - a padding-left reserved for a nav that is not rendered, which pushed
  //    the login card 224px off centre; and
  //  - the page transition, whose transform makes the motion.div the
  //    containing block for every position: fixed descendant. The admin
  //    sidebar is fixed left-0, so on each navigation it was measured from
  //    that padded box instead of the viewport: it jumped 224px inward and
  //    8px down, then snapped back the moment framer dropped the transform.
  //    That snap is what you see on every page switch.
  const isBarePage = isOBSPage || pathname.startsWith("/admin") || pathname.startsWith("/auth")

  // OBS browser sources need a truly transparent page so the stream
  // compositor shows through. The root layout's <body> always carries
  // bg-[#0B0B0D], which paints an opaque color behind these widgets, so we
  // strip it here rather than in the (server-only) root layout.
  useEffect(() => {
    document.body.classList.toggle("bg-[#0B0B0D]", !isOBSPage)
    document.body.classList.toggle("bg-transparent", isOBSPage)
  }, [isOBSPage])

  // These pages get none of this. A drifting background behind a browser
  // source would be composited over the stream, a page transition on a widget
  // that never navigates is dead weight, and the admin panel draws its own
  // sidebar, spacing and transition in app/admin/layout.tsx.
  if (isBarePage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen transition-[padding-left] duration-300 ease-in-out md:pl-[var(--main-nav-width,238px)]">
      <AmbientBackground />
      <MainNav />
      {/* The full-screen loading overlay used to live here, shown whenever a
          navigation took longer than 150ms. The entry animation is that
          feedback now, and having both meant a loading screen and then a
          transition for the same click. */}
      <main className="min-h-screen">
        <PageTransition>{children}</PageTransition>
      </main>
      <Reveal />
      <Footer />
    </div>
  )
}
