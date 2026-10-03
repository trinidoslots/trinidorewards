"use client"

import { useInAdminPanel } from "@/lib/use-admin-pathname"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { MonoLabel } from "@/components/ui/panel"
import { BrandMark } from "@/components/brand-mark"
import { createClient } from "@/lib/supabase/client"
import { MODULE_LINKS, navGroups, type ModuleRow } from "@/lib/site-modules"
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/site-socials"
import { SocialGlyph } from "@/components/social-glyph"

type FooterLink = { label: string; href: string; external?: boolean }

const LEGAL: { heading: string; links: FooterLink[] } = {
  heading: "Legal",
    links: [
      { label: "Terms of service", href: "/terms" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Gambling help", href: "https://www.gambleaware.org/", external: true },
    ],
}

export function Footer() {
  const pathname = usePathname()
  const inPanel = useInAdminPanel()
  const [mounted, setMounted] = useState(false)
  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([])
  // Edited on /admin/settings. Empty until loaded rather than the defaults,
  // so a removed link does not flash up first.
  const [socials, setSocials] = useState<{ platform: SocialPlatform; url: string }[]>([])

  useEffect(() => {
    setMounted(true)
    fetch("/api/socials")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setSocials(Array.isArray(json?.links) ? json.links : []))
      .catch(() => {})
  }, [])

  // The same rows and the same rule as the side navigation (navGroups): an
  // enabled module that is not hidden. The footer used to list four links by
  // hand, so a switched-off Store or Bonus Hunt still showed up down here.
  useEffect(() => {
    createClient()
      .from("modules")
      .select("*")
      .then(({ data }) => setModuleRows((data ?? []) as ModuleRow[]), () => {})
  }, [])

  const siteLinks: FooterLink[] = navGroups(moduleRows).flatMap((group) =>
    group.keys.map((key) => ({ label: MODULE_LINKS[key].label, href: MODULE_LINKS[key].href })),
  )
  const columns = siteLinks.length ? [{ heading: "Site", links: siteLinks }, LEGAL] : [LEGAL]

  // Hide footer on admin and auth routes
  if (inPanel || pathname.startsWith("/auth")) {
    return null
  }

  return (
    <footer
      className={`border-t border-white/[0.08] transition-opacity duration-500 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-8">
          {/* Brand */}
          <div className="min-w-48">
            <div className="flex items-center gap-2">
              {/* The mark draws its own tile, so no framing span — the same
                  change the navigation needed. */}
              <BrandMark className="h-7 w-7 shrink-0" />
              <span className="text-[13px] font-bold tracking-tight text-white">TrinidoRewards</span>
            </div>
            <MonoLabel className="mt-3 block text-white/25">© 2026 trinidorewards.com</MonoLabel>
          </div>

          {/* Link columns */}
          {columns.map((column) => (
            <nav key={column.heading} className="min-w-36">
              <MonoLabel className="block text-white/25">{column.heading}</MonoLabel>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-white/45 transition hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-[13px] text-white/45 transition hover:text-white">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Socials — outlined rather than white discs, which read as buttons */}
          {socials.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {socials.map((social) => (
                <a
                  key={`${social.platform}-${social.url}`}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={SOCIAL_PLATFORMS[social.platform]?.label ?? "Link"}
                  title={SOCIAL_PLATFORMS[social.platform]?.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.10] text-white/45 transition hover:border-white/25 hover:text-white"
                >
                  <SocialGlyph platform={social.platform} />
                </a>
              ))}
            </div>
          )}
        </div>

        <p className="mt-10 border-t border-white/[0.08] pt-6 text-[11px] leading-relaxed text-white/25">
          18+ · Gamble responsibly · BeGambleAware. Most people gamble for fun and enjoyment. Do not think of gambling as
          a way to make money. Only gamble with money you can afford to lose. Set a money and time limit in advance.
          Never chase your losses. Don&apos;t use gambling to distract yourself from everyday problems.
        </p>
      </div>
    </footer>
  )
}

