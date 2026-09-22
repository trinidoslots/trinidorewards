"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { MonoLabel } from "@/components/ui/panel"
import { BrandMark } from "@/components/brand-mark"

const NAV = [
  {
    heading: "Site",
    links: [
      { label: "Bonuses", href: "/bonuses" },
      { label: "Bonus hunt", href: "/bonushunt" },
      { label: "Stream store", href: "/store" },
      { label: "Leaderboard", href: "/leaderboard" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of service", href: "/terms" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Gambling help", href: "https://www.gambleaware.org/", external: true },
    ],
  },
]

const SOCIALS = [
  { label: "Discord", href: "https://discord.com", glyph: <DiscordGlyph /> },
  { label: "Kick", href: "https://kick.com/trinidoslots", glyph: <span className="text-[12px] font-bold">K</span> },
  { label: "X", href: "https://x.com", glyph: <XGlyph /> },
  { label: "YouTube", href: "https://youtube.com", glyph: <YouTubeGlyph /> },
]

export function Footer() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Hide footer on admin and auth routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) {
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
          {NAV.map((column) => (
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
          <div className="flex gap-2">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.10] text-white/45 transition hover:border-white/25 hover:text-white"
              >
                {social.glyph}
              </a>
            ))}
          </div>
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

function DiscordGlyph() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.076.076 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.077.077 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function XGlyph() {
  return (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function YouTubeGlyph() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}
