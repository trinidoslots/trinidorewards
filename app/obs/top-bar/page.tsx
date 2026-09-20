"use client"

import { useState, useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Wallet } from "lucide-react"
import { AnimatedAmount } from "@/components/animated-amount"
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

  const diffColor = walletStats.difference >= 0 ? "text-green-400" : "text-red-400"

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
        {/* 18+ Gamble Aware */}
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
              <span>♫</span>
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
                      <span className={timer.boldIcon ? "font-bold" : ""}>⏱</span>
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
                    {info.data_url && (
                      <img src={info.data_url} alt="info icon" className="w-5 h-5" style={{ filter: "brightness(0) saturate(100%) invert(1)" }} />
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

        {/* Wallet Difference */}
        <div className="flex items-center gap-1 text-white">
          <Wallet className="w-4 h-4 text-[#7FB3FF]" />
          <AnimatedAmount value={walletStats.difference} className="font-bold" toneClassName={diffColor} />
        </div>

        {/* BTC Price */}
        <div className="flex items-center gap-1 text-white">
          <span className="text-[#7FB3FF] font-bold">₿</span>
          <span className="font-bold">{formatCrypto(cryptoPrices.btc)}</span>
        </div>

        {/* ETH Price */}
        <div className="flex items-center gap-1 text-white">
          <span className="text-[#7FB3FF] font-bold">Ξ</span>
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
