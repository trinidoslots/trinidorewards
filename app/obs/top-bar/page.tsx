"use client"

import { useState, useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Music } from "lucide-react"
import { AnimatedAmount } from "@/components/animated-amount"
import { BrandMark } from "@/components/brand-mark"
import { totalsFor } from "@/lib/transactions"
import { COLUMN_EDGE, TOP_BAR_GRADIENT } from "@/lib/obs-theme"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

interface CryptoPrice {
  btc: number
  eth: number
  btcChange: number
  ethChange: number
}

interface WalletStats {
  totalDeposits: number
  totalWithdraws: number
  difference: number
}

interface Timer {
  id: string
  message: string
  end_time: string
  active: boolean
  boldIcon?: boolean
  boldMessage?: boolean
  boldTime?: boolean
  data_url?: string
}

interface WordStyle {
  index: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

interface Info {
  id: string
  message: string
  active: boolean
  word_styles?: WordStyle[]
  data_url?: string
}

/**
 * Every icon in the strip, at one size and one colour.
 *
 * They used to be a mix: two lucide glyphs, and ♫ ⏱ ₿ Ξ typed as text. A text
 * character is the font's drawing rather than an icon set's — its own weight,
 * its own optical size, and on some builds the timer one renders as a colour
 * emoji — so the row read as four icons from four places.
 *
 * Now they are drawn: Kick's own mark, the Bitcoin, Ethereum and wallet set
 * supplied below, and two supplied PNGs — a stopwatch for a timer and a
 * trophy for a win line, each the default when no custom icon was uploaded
 * against that row. Those two are 256px white-on-transparent, so they carry
 * sixteen times the detail they are drawn at and need no recolouring.
 *
 * Music is still lucide: nothing was supplied for it, and it only appears
 * while a track is playing.
 *
 * 16px square and white, which is also what user-uploaded custom icons are
 * forced to. The Kick mark is the one exception on width: it is taller than
 * it is wide and sets its own.
 */
const ICON_CLASS = "w-4 h-4 shrink-0 text-white"

/** The channel the follower count is for. */
const KICK_SLUG = "trinidoslots"

/**
 * Kick's mark — the real one.
 *
 * The first K of the KICK wordmark at static.kick.com/kick-logo.svg, taken
 * path-for-path: the first subpath of four, which spans x 0 to 20.523 of that
 * file's 72x24 box. My first attempt was a K I drew myself, with a diagonal
 * in it, and Kick's is built entirely from right angles — which is exactly
 * why it read as "some K" rather than as their logo.
 *
 * Taller than it is wide, so it cannot use the square ICON_CLASS. Height is
 * matched to the others and the width follows from the aspect ratio.
 */
function KickIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20.523 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden
      className={className}
    >
      <path d="M0 .028h7.7v5.32h2.561v-2.66h2.562V.028h7.7v7.996H17.96v2.66h-2.562v2.66h2.562v2.66h2.562V24h-7.699v-2.66h-2.562v-2.66H7.7V24H0V.028Z" />
    </svg>
  )
}

/*
 * Bitcoin, Ethereum and the wallet, from the set supplied in Downloads/icons
 * neu — path for path, at their own 24x24 box.
 *
 * The files paint #C8C8D0. That is replaced by currentColor throughout, so the
 * icons take the strip's white like everything else and a single class changes
 * all three. To go back to the supplied grey, set that colour on the wrapper
 * rather than on the paths.
 *
 * Their C2PA metadata is dropped: a few kilobytes of signed provenance per
 * icon, inlined into every page load, describing where the file came from
 * rather than what it draws.
 */

/** A stroked ₿, the letterform rather than a roundel. */
function BitcoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g
        transform="translate(-0.6,0)"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth="2.2"
      >
        <path d="M6.5 6 H13.5 A3 3 0 0 1 13.5 12 H8.2" />
        <path d="M8.2 12 H14.3 A3.5 3.5 0 0 1 14.3 19 H6.5" />
        <path d="M8.2 6 V19" />
        <path d="M10.4 3.4 V6 M13.4 3.4 V6 M10.4 19 V21.6 M13.4 19 V21.6" strokeWidth="1.9" />
      </g>
    </svg>
  )
}

/** The Ethereum diamond, upper and lower halves. */
function EthereumIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M12 2.5 L18 12 L12 15.4 L6 12 Z" />
        <path d="M6 14 L12 17.5 L18 14 L12 21.5 Z" />
      </g>
    </svg>
  )
}

/**
 * The wallet, cut out of a filled square by a mask.
 *
 * The mask's id is namespaced. In the file it is "w", and an id that short in
 * a page that also renders a hunt board and a scene column is asking for a
 * collision — mask references resolve document-wide, and the loser silently
 * renders as a solid block.
 */
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <mask id="obs-top-bar-wallet">
          <rect width="24" height="24" fill="#000" />
          <rect x="2.5" y="5.5" width="17" height="13" rx="3.5" fill="#fff" />
          <rect x="13" y="8.6" width="9.5" height="6.8" rx="3.4" fill="#000" />
          <rect x="14" y="9.5" width="7.5" height="5" rx="2.5" fill="#fff" />
          <circle cx="16.6" cy="12" r="1.05" fill="#000" />
        </mask>
      </defs>
      <rect width="24" height="24" fill="currentColor" mask="url(#obs-top-bar-wallet)" />
    </svg>
  )
}

function TopBarWidget() {
  // Set by /obs/complete: a column continues directly below this strip.
  const embedded = useSearchParams().get("embedded") === "1"
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrice>({
    btc: 0,
    eth: 0,
    btcChange: 0,
    ethChange: 0,
  })
  const [walletStats, setWalletStats] = useState<WalletStats>({
    totalDeposits: 0,
    totalWithdraws: 0,
    difference: 0,
  })
  const [currentTime, setCurrentTime] = useState("")
  const [currentTrack, setCurrentTrack] = useState("")
  // null until the first successful read — see the render for why it matters.
  const [kickFollowers, setKickFollowers] = useState<number | null>(null)
  const [timers, setTimers] = useState<Timer[]>([])
  const [infos, setInfos] = useState<Info[]>([])
  const [loading, setLoading] = useState(true)
  const [lastTimerCheckHash, setLastTimerCheckHash] = useState<string>("")
  const [lastInfoCheckHash, setLastInfoCheckHash] = useState<string>("")
  const timersRef = useRef<Timer[]>([])

  const supabase = createBrowserClient()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, "0")
      const minutes = String(now.getMinutes()).padStart(2, "0")
      const day = String(now.getDate()).padStart(2, "0")
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const year = now.getFullYear()
      setCurrentTime(`${hours}:${minutes} CEST ${day}.${month}.${year}`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  /**
   * The follower count, every minute.
   *
   * On failure the previous number is kept rather than cleared: a follower
   * count that blinks out whenever Kick is slow is worse than one that is a
   * minute stale, and this runs unattended for a whole stream.
   */
  useEffect(() => {
    let cancelled = false

    const readFollowers = async () => {
      try {
        const response = await fetch(`/api/kick/followers?slug=${KICK_SLUG}`, { cache: "no-store" })
        if (!response.ok) return
        const payload = await response.json()
        if (!cancelled && typeof payload?.followers === "number") setKickFollowers(payload.followers)
      } catch {
        // Keep whatever was last known.
      }
    }

    readFollowers()
    const interval = setInterval(readFollowers, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Calculate remaining seconds until end_time
  function getRemainingSeconds(endTime: string): number {
    const now = new Date().getTime()
    const end = new Date(endTime).getTime()
    const remaining = Math.floor((end - now) / 1000)
    return Math.max(0, remaining)
  }

  // Format seconds to MM:SS
  function formatTime(seconds: number): string {
    if (seconds <= 0) return "SOON"
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  }

  useEffect(() => {
    fetchWalletStats()
    
    // Poll wallet stats every 5 seconds
    const walletInterval = setInterval(() => {
      fetchWalletStats()
    }, 5000)
    
    // Subscribe to wallet changes in real-time
    const channel = supabase
      .channel("wallet_changes", { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transaction_events",
        },
        (payload) => {
          console.log("[v0] Wallet data changed:", payload)
          fetchWalletStats()
        }
      )
      .subscribe()

    return () => {
      clearInterval(walletInterval)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    // Load timers from Supabase on mount
    loadTimersFromDatabase()
    loadInfoFromDatabase()
    
    // Subscribe to timer changes in real-time
    const timerChannel = supabase
      .channel("obs_timers_changes", { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "obs_timers",
        },
        (payload) => {
          console.log("[v0] Timer change detected via realtime:", payload)
          loadTimersFromDatabase()
        }
      )
      .subscribe()

    // Subscribe to info changes in real-time
    const infoChannel = supabase
      .channel("obs_info_changes", { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "obs_info",
        },
        (payload) => {
          console.log("[v0] Info change detected via realtime:", payload)
          loadInfoFromDatabase()
        }
      )
      .subscribe()

    // Poll every 5 seconds but only check for metadata changes
    const pollInterval = setInterval(() => {
      checkTimerMetadataChanges()
      checkInfoMetadataChanges()
    }, 5000)

    return () => {
      supabase.removeChannel(timerChannel)
      supabase.removeChannel(infoChannel)
      clearInterval(pollInterval)
    }
  }, [lastTimerCheckHash, lastInfoCheckHash])

  async function checkInfoMetadataChanges() {
    try {
      const { data, error } = await supabase
        .from("obs_info")
        .select("id, active")
        .eq("active", true)
        .order("created_at", { ascending: false })

      if (!error && data) {
        // Create hash of IDs only
        const metadataHash = data.map((i: any) => i.id).join("|")
        
        // If metadata changed (info added/removed), reload full data
        if (metadataHash !== lastInfoCheckHash) {
          console.log("[v0] Info metadata changed, reloading...")
          await loadInfoFromDatabase()
        }
      }
    } catch (error) {
      console.error("Error checking info metadata:", error)
    }
  }

  async function loadInfoFromDatabase() {
    try {
      console.log("[v0] Loading info from database...")
      const { data, error } = await supabase
        .from("obs_info")
        .select("id, message, active, word_styles, data_url")
        .eq("active", true)
        .order("created_at", { ascending: false })

      if (!error && data) {
        const currentHash = data.map((i: any) => i.id).join("|")
        setLastInfoCheckHash(currentHash)
        
        console.log("[v0] Loaded info from database:", data)
        setInfos(data as Info[])
      } else if (error) {
        console.error("[v0] Error loading info:", error)
      }
    } catch (error) {
      console.error("Error loading info from database:", error)
    }
  }

  async function checkTimerMetadataChanges() {
    try {
      const { data, error } = await supabase
        .from("obs_timers")
        .select("id, active, started")
        .eq("active", true)
        .order("created_at", { ascending: false })

      if (!error && data) {
        // Create hash of IDs and started status only
        const metadataHash = data.map((t: any) => `${t.id}:${t.started}`).join("|")
        
        // If metadata changed (timer added/removed/started-stopped), reload full data
        if (metadataHash !== lastTimerCheckHash) {
          console.log("[v0] Timer metadata changed, reloading...")
          await loadTimersFromDatabase()
        }
      }
    } catch (error) {
      console.error("Error checking timer metadata:", error)
    }
  }

  async function loadTimersFromDatabase() {
    try {
      console.log("[v0] Loading full timer data from database...")
      const { data, error } = await supabase
        .from("obs_timers")
        .select("id, message, end_time, active, bold_icon, bold_message, bold_time, data_url")
        .eq("active", true)
        .order("created_at", { ascending: false })

      if (!error && data) {
        // Create a hash of the timer IDs and end_time
        const currentHash = data.map((t: any) => `${t.id}:${t.end_time}`).join("|")
        setLastTimerCheckHash(currentHash)
        
        // Convert snake_case from database to camelCase for component
        const timersWithCamelCase = data.map((t: any) => ({
          id: t.id,
          message: t.message,
          end_time: t.end_time,
          active: t.active,
          boldIcon: t.bold_icon,
          boldMessage: t.bold_message,
          boldTime: t.bold_time,
          data_url: t.data_url,
        }))
        console.log("[v0] Loaded full timers from database:", timersWithCamelCase)
        setTimers(timersWithCamelCase as Timer[])
        timersRef.current = timersWithCamelCase
      } else if (error) {
        console.error("[v0] Error loading timers:", error)
      }
    } catch (error) {
      console.error("Error loading timers from database:", error)
    }
  }

  useEffect(() => {
    // Initialize loading state
    const initializeWidget = async () => {
      await Promise.all([fetchCryptoPrices(), fetchWalletStats()])
      setLoading(false)
    }
    
    initializeWidget()
  }, [])

  useEffect(() => {
    // Decrement timers every second
    const timerCountdownInterval = setInterval(() => {
      updateTimers()
    }, 1000)

    return () => clearInterval(timerCountdownInterval)
  }, [])

  useEffect(() => {
    // Fetch crypto prices every 30 seconds
    const interval = setInterval(() => {
      fetchCryptoPrices()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  async function fetchCryptoPrices() {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
      )
      const data = await response.json()
      setCryptoPrices({
        btc: data.bitcoin.usd,
        eth: data.ethereum.usd,
        btcChange: data.bitcoin.usd_24h_change,
        ethChange: data.ethereum.usd_24h_change,
      })
    } catch (error) {
      console.error("Error fetching crypto prices:", error)
    }
  }

  async function fetchWalletStats() {
    try {
      const { data, error } = await supabase
        .from("transaction_events")
        .select("kind, amount")

      if (!error && data && data.length > 0) {
        const { deposited: totalDeposits, cashedOut: totalWithdraws, net: difference } = totalsFor(data as any)

        console.log("[v0] Wallet Stats - Deposits:", totalDeposits, "Withdraws:", totalWithdraws, "Difference:", difference)

        setWalletStats({
          totalDeposits,
          totalWithdraws,
          difference,
        })
      } else {
        // If no data, set all values to 0
        console.log("[v0] No wallet records found, setting to 0")
        setWalletStats({
          totalDeposits: 0,
          totalWithdraws: 0,
          difference: 0,
        })
      }
    } catch (error) {
      console.error("Error fetching wallet stats:", error)
    }
  }

  function updateTime() {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const year = now.getFullYear()
    setCurrentTime(`${hours}:${minutes} ${day}.${month}.${year}`)
  }

  function updateTimers() {
    // Each timer counts down to its own end_time, so there is nothing stored to
    // decrement: this tick just gives the list a new identity once a second so
    // the rendered remaining time advances.
    setTimers((prevTimers) => [...prevTimers])
  }

  if (loading) {
    return <div className="w-full h-screen flex items-center justify-center bg-slate-950">Loading...</div>
  }

  const formatCrypto = (price: number) => {
    return `$${Math.round(price).toLocaleString("en-US")}`
  }

  return (
    <div
      className="w-screen border-b px-4 py-2 overflow-hidden flex items-center justify-between"
      style={{
        fontFamily: "Geist, sans-serif",
        width: "1920px",
        height: "50px",
        backgroundImage: TOP_BAR_GRADIENT,
        // No edge when a column continues below: the seam is meant to be
        // invisible, and a hairline across it is the one thing that cannot be.
        borderBottomColor: embedded ? "transparent" : COLUMN_EDGE,
      }}
    >
      {/* Left Content - Gamble Aware, Timers, Track */}
      <div className="flex items-center gap-3 flex-1 h-full overflow-x-auto whitespace-nowrap text-base">
        {/* The brand mark, then 18+ Gamble Aware. The mark carries its own
            tile, so it sits at the strip's icon height and needs no frame. */}
        <BrandMark className="h-5 w-5 shrink-0" />

        <div className="flex items-center gap-1 text-white font-bold">
          <span>18+</span>
          <span>GAMBLE AWARE</span>
        </div>

        {/* Separator */}
        <span className="text-[#4D84FF]/50">|</span>

        {/* Current Track */}
        {currentTrack && (
          <>
            <div className="flex items-center gap-1 text-[#7FB3FF]">
              <Music className={ICON_CLASS} />
              <span>{currentTrack}</span>
            </div>
            <span className="text-[#4D84FF]/50">|</span>
          </>
        )}

        {/* Active Timers */}
        {timers && timers.filter((t) => getRemainingSeconds(t.end_time) > 0).length > 0 && (
          <>
            <div className="flex items-center gap-2 text-white">
              {timers
                .filter((t) => getRemainingSeconds(t.end_time) > 0)
                .map((timer, idx) => (
                  <div key={timer.id} className="flex items-center gap-1">
                    {timer.data_url ? (
                      <img src={timer.data_url} alt="timer icon" className="w-5 h-5" style={{ filter: "brightness(0) saturate(100%) invert(1)" }} />
                    ) : (
                      <img src="/obs-timer-white.png" alt="" className={ICON_CLASS} />
                    )}
                    <span className={timer.boldMessage ? "font-bold" : ""}>{timer.message}</span>
                    <span className={timer.boldTime ? "font-bold" : ""}>
                      {formatTime(getRemainingSeconds(timer.end_time))}
                    </span>
                    {idx < timers.filter((t) => getRemainingSeconds(t.end_time) > 0).length - 1 && (
                      <span className="text-[#4D84FF]/50">|</span>
                    )}
                  </div>
                ))}
            </div>
            <span className="text-[#4D84FF]/50">|</span>
          </>
        )}

        {/* Info Items */}
        {infos && infos.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-white">
              {infos.map((info, idx) => {
                const words = info.message.split(" ")
                const wordStyles = (info.word_styles || []) as WordStyle[]
                
                return (
                  <div key={info.id} className="flex items-center gap-1">
                    {info.data_url ? (
                      <img src={info.data_url} alt="info icon" className="w-5 h-5" style={{ filter: "brightness(0) saturate(100%) invert(1)" }} />
                    ) : (
                      /* The trophy, for a win line that brought no icon of its own. */
                      <img src="/obs-win-white.png" alt="" className={ICON_CLASS} />
                    )}
                    {words.map((word, idx) => {
                      const style = wordStyles.find((s) => s.index === idx)
                      return (
                        <span
                          key={idx}
                          className={`${style?.bold ? "font-bold" : ""} ${
                            style?.italic ? "italic" : ""
                          } ${style?.underline ? "underline" : ""}`}
                        >
                          {word}
                        </span>
                      )
                    })}
                    {idx < infos.length - 1 && (
                      <span className="text-[#4D84FF]/50">|</span>
                    )}
                  </div>
                )
              })}
            </div>
            <span className="text-[#4D84FF]/50">|</span>
          </>
        )}
      </div>

      {/* Right Content - Crypto, Wallet & Time */}
      <div className="flex items-center gap-3 text-white ml-4 flex-shrink-0 text-base">
        {/* Separator */}
        <span className="text-[#4D84FF]/50">|</span>

        {/* Kick followers. Hidden until the number is known, so a failed fetch
            leaves a gap rather than a confident 0 next to the wallet. */}
        {kickFollowers !== null && (
          <div className="flex items-center gap-1 text-white">
            {/* h-4 w-auto, not ICON_CLASS: the mark is 20.5 wide by 24 tall,
                and a square box would squash it. */}
            <KickIcon className="h-4 w-auto shrink-0 text-white" />
            <span className="font-bold">{kickFollowers.toLocaleString("en-US")}</span>
          </div>
        )}

        {/* Wallet Difference */}
        <div className="flex items-center gap-1 text-white">
          <WalletIcon className={ICON_CLASS} />
          <AnimatedAmount value={walletStats.difference} className="font-bold" toneClassName="text-white" />
        </div>

        {/* BTC Price */}
        <div className="flex items-center gap-1 text-white">
          <BitcoinIcon className={ICON_CLASS} />
          <span className="font-bold">{formatCrypto(cryptoPrices.btc)}</span>
        </div>

        {/* ETH Price */}
        <div className="flex items-center gap-1 text-white">
          <EthereumIcon className={ICON_CLASS} />
          <span className="font-bold">{formatCrypto(cryptoPrices.eth)}</span>
        </div>

        {/* Separator */}
        <span className="text-[#4D84FF]/50">|</span>

        {/* Time */}
        <span className="text-white">{currentTime}</span>
      </div>
    </div>
  )
}

export default function TopBarObsWidgetPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div style={{ width: 1920, height: 50 }} />}>
      <TopBarWidget />
    </Suspense>
  )
}
