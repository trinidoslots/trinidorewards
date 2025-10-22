"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

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
      className={`bg-slate-950 border-t border-slate-800/50 transition-opacity duration-500 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
          {/* Logo and Copyright */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/favicon.png" alt="TrinidoRewards" className="w-full h-full object-cover" />
              </div>
              <span className="text-white font-bold text-lg">TrinidoRewards</span>
            </div>
            <p className="text-slate-500 text-xs">© 2025 TrinidoRewards.com</p>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Link
                href="/bonuses"
                className="block text-slate-300 hover:text-cyan-400 text-sm font-medium transition-colors"
              >
                BONUSES
              </Link>
              <Link
                href="/bonushunt"
                className="block text-slate-300 hover:text-cyan-400 text-sm font-medium transition-colors"
              >
                BONUS HUNT
              </Link>
              <Link
                href="/store"
                className="block text-slate-300 hover:text-cyan-400 text-sm font-medium transition-colors"
              >
                STREAM STORE
              </Link>
              <Link
                href="/leaderboard"
                className="block text-slate-300 hover:text-cyan-400 text-sm font-medium transition-colors"
              >
                LEADERBOARD
              </Link>
            </div>
            <div className="space-y-2">
              <Link
                href="/terms"
                className="block text-slate-300 hover:text-cyan-400 text-sm font-medium transition-colors"
              >
                TERMS OF SERVICE
              </Link>
              <Link
                href="/privacy"
                className="block text-slate-300 hover:text-cyan-400 text-sm font-medium transition-colors"
              >
                PRIVACY POLICY
              </Link>
              <a
                href="https://www.gambleaware.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-slate-300 hover:text-cyan-400 text-sm font-medium transition-colors"
              >
                GAMBLING HELP
              </a>
            </div>
          </div>

          {/* Social Media Icons */}
          <div className="flex items-start justify-end gap-3">
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white hover:bg-cyan-400 flex items-center justify-center transition-colors"
              aria-label="Discord"
            >
              <svg className="w-5 h-5 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.076.076 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.077.077 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
            <a
              href="https://kick.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white hover:bg-cyan-400 flex items-center justify-center transition-colors"
              aria-label="Kick"
            >
              <span className="text-slate-950 font-bold text-sm">K</span>
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white hover:bg-cyan-400 flex items-center justify-center transition-colors"
              aria-label="X (Twitter)"
            >
              <svg className="w-4 h-4 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-white hover:bg-cyan-400 flex items-center justify-center transition-colors"
              aria-label="YouTube"
            >
              <svg className="w-5 h-5 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Responsible Gambling Disclaimer */}
        <div className="pt-6 border-t border-slate-800/50">
          <p className="text-slate-500 text-xs text-center leading-relaxed">
            18+ | Gamble Responsibly | BeGambleAware. Most people gamble for fun and enjoyment. Do not think of gambling
            as a way to make money. Only gamble with money you can afford to lose. Set a money and time limit in
            advance. Never chase your losses. Don't use gambling to distract yourself from everyday problems.
          </p>
        </div>
      </div>
    </footer>
  )
}
