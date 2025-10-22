"use client"

import Link from "next/link"
import { Crown, Award, ChevronDown, Home, User } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { LoginModal } from "./login-modal"

export function MainNav() {
  const [bonusesOpen, setBonusesOpen] = useState(false)
  const [streamOpen, setStreamOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [points, setPoints] = useState<number>(0)
  const pathname = usePathname()

  const bonusesTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (response.ok) {
          const data = await response.json()
          setUsername(data.username)
          setPoints(data.points || 0)

          if (data.user) {
            try {
              const syncResponse = await fetch("/api/kicklet/sync-points", {
                method: "POST",
              })
              if (syncResponse.ok) {
                const syncData = await syncResponse.json()
                if (syncData.points !== undefined) {
                  setPoints(syncData.points)
                }
              }
            } catch (syncError) {
              console.error("[v0] Failed to sync points from Kicklet:", syncError)
            }
          }
        }
      } catch (error) {
        console.error("[v0] Failed to check auth:", error)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    return () => {
      if (bonusesTimeoutRef.current) clearTimeout(bonusesTimeoutRef.current)
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current)
    }
  }, [])

  const handleBonusesMouseEnter = () => {
    if (bonusesTimeoutRef.current) {
      clearTimeout(bonusesTimeoutRef.current)
      bonusesTimeoutRef.current = null
    }
    setBonusesOpen(true)
  }

  const handleBonusesMouseLeave = () => {
    bonusesTimeoutRef.current = setTimeout(() => {
      setBonusesOpen(false)
    }, 300) // Reduced delay from 500ms to 300ms
  }

  const handleStreamMouseEnter = () => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }
    setStreamOpen(true)
  }

  const handleStreamMouseLeave = () => {
    streamTimeoutRef.current = setTimeout(() => {
      setStreamOpen(false)
    }, 300) // Reduced delay from 500ms to 300ms
  }

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/auth")) {
    return null
  }

  return (
    <>
      <header className="border-b border-slate-800/50 backdrop-blur sticky top-0 z-50 bg-slate-950/80">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/favicon.png" alt="TrinidoRewards" className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-lg">TrinidoRewards</span>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-xs font-medium">LIVE</span>
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <div className="relative" onMouseEnter={handleBonusesMouseEnter} onMouseLeave={handleBonusesMouseLeave}>
                <button
                  onClick={() => {
                    setBonusesOpen(!bonusesOpen)
                    setStreamOpen(false)
                  }}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-sm"
                >
                  <Award className="w-4 h-4" />
                  Bonuses
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div
                  className={`absolute top-full left-0 mt-2 w-48 bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-lg shadow-xl py-2 z-50 transition-all duration-200 ${
                    bonusesOpen
                      ? "opacity-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 -translate-y-2 pointer-events-none"
                  }`}
                >
                  <Link
                    href="/bonuses/claim"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                    onClick={() => setBonusesOpen(false)}
                  >
                    Claim Bonuses
                  </Link>
                  <Link
                    href="/bonuses/active"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                    onClick={() => setBonusesOpen(false)}
                  >
                    Active Bonuses
                  </Link>
                </div>
              </div>

              <div className="relative" onMouseEnter={handleStreamMouseEnter} onMouseLeave={handleStreamMouseLeave}>
                <button
                  onClick={() => {
                    setStreamOpen(!streamOpen)
                    setBonusesOpen(false)
                  }}
                  className={`flex items-center gap-1.5 transition-colors text-sm ${
                    streamOpen ? "text-cyan-400" : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Home className="w-4 h-4" />
                  Stream
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div
                  className={`absolute top-full left-0 mt-2 w-48 bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-lg shadow-xl py-2 z-50 transition-all duration-200 ${
                    streamOpen
                      ? "opacity-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 -translate-y-2 pointer-events-none"
                  }`}
                >
                  <Link
                    href="/store"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                    onClick={() => setStreamOpen(false)}
                  >
                    Stream Store
                  </Link>
                  <Link
                    href="/bonushunt"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                    onClick={() => setStreamOpen(false)}
                  >
                    Bonus Hunt
                  </Link>
                  <Link
                    href="/raffles"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                    onClick={() => setStreamOpen(false)}
                  >
                    Raffles
                  </Link>
                  <Link
                    href="/schedule"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                    onClick={() => setStreamOpen(false)}
                  >
                    Schedule
                  </Link>
                  <Link
                    href="/tournaments"
                    className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                    onClick={() => setStreamOpen(false)}
                  >
                    Tournaments
                  </Link>
                </div>
              </div>

              <Link
                href="/leaderboard"
                className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-sm"
              >
                <Crown className="w-4 h-4" />
                Leaderboard
              </Link>
            </nav>

            {username ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-lg border border-amber-500/30">
                  <span className="text-amber-400 text-lg">🪙</span>
                  <span className="text-amber-400 text-sm font-bold">{points.toLocaleString()}</span>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700/50 transition-colors"
                >
                  <User className="w-4 h-4 text-green-400" />
                  <span className="text-white text-sm font-medium">{username}</span>
                </Link>
              </div>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg font-medium text-sm transition-all"
              >
                LOGIN
              </button>
            )}
          </div>
        </div>
      </header>

      <LoginModal open={loginModalOpen} onOpenChange={setLoginModalOpen} />
    </>
  )
}
