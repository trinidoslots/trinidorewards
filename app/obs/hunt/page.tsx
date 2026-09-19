"use client"

import { createClient } from "@/lib/supabase/client"
import { getActiveHunt } from "@/lib/active-hunt"
import { Coins, ChevronRight, ChevronLeft, Crown } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { OBS, OBS_RADIUS } from "@/lib/obs-theme"

type BonusHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
  is_super: boolean
  image_url?: string | null
}

export default function OBSWidget() {
  const [hunts, setHunts] = useState<BonusHunt[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpening, setIsOpening] = useState(false)
  const [obsViewMode, setObsViewMode] = useState<"opening" | "normal">("opening")
  const [huntSource, setHuntSource] = useState<"integrated" | "external">("integrated")
  const [externalHuntStatus, setExternalHuntStatus] = useState<string | null>(null)
  const [startingBalance, setStartingBalance] = useState(0)
  const supabase = createClient()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const collectingScrollRef = useRef<HTMLDivElement>(null)
  const lastScrolledBonusRef = useRef<string | null>(null)

  async function fetchBonusHunts() {
    try {
      if (huntSource === "external") {
        const response = await fetch("/api/external/current-hunt", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || "Failed to fetch external hunt")
        }

        const externalHunts = (payload.rows || []) as BonusHunt[]
        setHunts(externalHunts)
        setExternalHuntStatus(payload.status ?? null)
        setIsOpening(payload.status === "opening")
        setStartingBalance(Number(externalHunts[0]?.starting_balance || 0))
        setLoading(false)
        return
      }

      const activeHunt = await getActiveHunt(supabase)
      if (!activeHunt) {
        setHunts([])
        setStartingBalance(0)
        setLoading(false)
        return
      }

      setStartingBalance(Number(activeHunt.starting_balance))

      const { data, error } = await supabase
        .from("hunt_bonuses")
        .select("id, game_name, provider, bet_size, result, created_at, is_super, image_url, position")
        .eq("hunt_id", activeHunt.id)
        .order("position", { ascending: true })

      if (error) {
        console.error("Error fetching hunt bonuses:", error)
        setLoading(false)
        return
      }

      setHunts(
        (data || []).map((bonus) => ({
          ...bonus,
          starting_balance: activeHunt.starting_balance,
          opening_balance: 0,
        })) as BonusHunt[],
      )
      setLoading(false)
    } catch (err) {
      console.error("Error in fetchBonusHunts:", err)
      setLoading(false)
    }
  }

  async function fetchOpeningState() {
    const { data, error } = await supabase.from("opening_state").select("is_opening").limit(1).single()

    if (error) {
      console.error("Error fetching opening state:", error)
      return
    }

    setIsOpening(data?.is_opening ?? false)
  }

  async function fetchObsSettings() {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["obs_view_mode", "hunt_source"])

    if (error) {
      console.error("Error fetching OBS settings:", error)
      return
    }

    const settings = Object.fromEntries((data || []).map((setting) => [setting.key, setting.value]))
    setObsViewMode((settings.obs_view_mode as "opening" | "normal") || "opening")
    const nextHuntSource = settings.hunt_source === "external" ? "external" : "integrated"
    setHuntSource(nextHuntSource)
    if (nextHuntSource === "integrated") {
      setExternalHuntStatus(null)
    }
  }

  useEffect(() => {
    let disposed = false

    const refreshWidgetData = async () => {
      await fetchObsSettings()
      if (disposed) return
      await fetchBonusHunts()
      if (!disposed && huntSource === "integrated") {
        await fetchOpeningState()
      }
    }

    refreshWidgetData()

    // Keep one long-lived poller so changing hunt_source cannot leave a stale
    // interval behind. The external proxy is cached and status comes from the
    // selected hunt detail endpoint.
    const pollInterval = setInterval(refreshWidgetData, 10_000)

    const bonusChannel = supabase
      .channel("bonus_hunts_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bonus_hunts" }, () => fetchBonusHunts())
      .on("postgres_changes", { event: "*", schema: "public", table: "hunt_bonuses" }, () => fetchBonusHunts())
      .subscribe()

    const stateChannel = supabase
      .channel("opening_state_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "opening_state" }, () => fetchOpeningState())
      .subscribe()

    const settingsChannel = supabase
      .channel("settings_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        fetchObsSettings().then(() => fetchBonusHunts())
      })
      .subscribe()

    return () => {
      disposed = true
      clearInterval(pollInterval)
      supabase.removeChannel(bonusChannel)
      supabase.removeChannel(stateChannel)
      supabase.removeChannel(settingsChannel)
    }
  }, [huntSource])

  useEffect(() => {
    if (obsViewMode === "opening" || hunts.length <= 6) return

    const container = scrollContainerRef.current
    if (!container) return

    let scrollPosition = 0
    let isPaused = false
    let isScrollingUp = false
    let scrollUpStartTime = 0
    let scrollUpStartPosition = 0
    let animationId: number

    const animate = (timestamp: number) => {
      if (!container) return

      if (isPaused) {
        animationId = requestAnimationFrame(animate)
        return
      }

      if (isScrollingUp) {
        if (scrollUpStartTime === 0) {
          scrollUpStartTime = timestamp
          scrollUpStartPosition = scrollPosition
        }

        const elapsed = timestamp - scrollUpStartTime
        const duration = 800
        const progress = Math.min(elapsed / duration, 1)

        const easeOutCubic = 1 - Math.pow(1 - progress, 3)

        scrollPosition = scrollUpStartPosition * (1 - easeOutCubic)
        container.scrollTop = scrollPosition

        if (progress >= 1) {
          scrollPosition = 0
          container.scrollTop = 0
          isScrollingUp = false
          scrollUpStartTime = 0

          isPaused = true
          setTimeout(() => {
            isPaused = false
          }, 1000)
        }

        animationId = requestAnimationFrame(animate)
        return
      }

      scrollPosition += 0.4

      const totalHeight = container.scrollHeight
      const singleListHeight = totalHeight / 5
      const maxScroll = singleListHeight * 4 + 20

      if (scrollPosition >= maxScroll) {
        isPaused = true
        setTimeout(() => {
          isScrollingUp = true
          isPaused = false
        }, 3000)
      } else {
        container.scrollTop = scrollPosition
      }

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [obsViewMode, hunts.length])

  useEffect(() => {
    if (isOpening) return

    // Only auto-scroll once there are enough slots to overflow the widget (16+)
    if (hunts.length <= 15) return

    const container = collectingScrollRef.current
    if (!container) return

    // The grid is rendered twice back-to-back (see JSX), so once we scroll past
    // the height of the first copy we can silently loop back to 0 for a seamless,
    // indefinite scroll instead of pausing and reversing.
    let scrollPosition = 0
    let isPaused = true
    let animationId: number

    const startTimeout = setTimeout(() => {
      isPaused = false
    }, 1500)

    const animate = () => {
      if (!container) return

      if (isPaused) {
        animationId = requestAnimationFrame(animate)
        return
      }

      scrollPosition += 0.4

      const loopPoint = container.scrollHeight / 2

      if (scrollPosition >= loopPoint) {
        scrollPosition -= loopPoint
      }

      container.scrollTop = scrollPosition

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      clearTimeout(startTimeout)
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [isOpening, hunts.length])

  useEffect(() => {
    if (obsViewMode !== "opening") return

    const container = scrollContainerRef.current
    if (!container) return

    const firstUnopened = hunts.find((h) => !h.result || h.result === 0)
    if (!firstUnopened) return

    // Only scroll if the unopened bonus has changed
    if (lastScrolledBonusRef.current === firstUnopened.id) return

    lastScrolledBonusRef.current = firstUnopened.id

    const bonusElement = document.getElementById(`bonus-${firstUnopened.id}`)
    if (bonusElement) {
      bonusElement.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [obsViewMode, hunts])

  if (loading) {
    return (
      <div className="h-screen w-full bg-transparent">
        <div
          className="flex h-full w-full items-center justify-center p-2 shadow-2xl"
          style={{ backgroundColor: OBS.shell, borderRadius: OBS_RADIUS.shell }}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: OBS.muted }}>
            Loading
          </span>
        </div>
      </div>
    )
  }

  const totalBonuses = hunts.length
  const completedHunts = hunts.filter((h) => h.result && h.result > 0)
  const unopenedBonuses = hunts.filter((h) => !h.result || h.result === 0)
  const superBonuses = hunts.filter((h) => h.is_super)

  const totalWinsSoFar = hunts.reduce((sum, h) => sum + (Number(h.result) || 0), 0)
  const totalRemainingStakes = unopenedBonuses.reduce((sum, h) => sum + Number(h.bet_size), 0)
  const breakEvenX =
    totalRemainingStakes > 0 ? Math.max(0, (startingBalance - totalWinsSoFar) / totalRemainingStakes) : 0

  const totalMultiplier = completedHunts.reduce((sum, h) => {
    if (h.result && h.bet_size) {
      return sum + Number(h.result) / Number(h.bet_size)
    }
    return sum
  }, 0)
  const averageMultiplier = completedHunts.length > 0 ? totalMultiplier / completedHunts.length : 0

  const highestWin = hunts.reduce(
    (max, h) => {
      if (h.result && Number(h.result) > max.amount) {
        return {
          game: h.game_name,
          amount: Number(h.result),
          betSize: Number(h.bet_size),
        }
      }
      return max
    },
    { game: "", amount: 0, betSize: 0 },
  )
  const highestWinMultiplier = highestWin.betSize > 0 ? highestWin.amount / highestWin.betSize : 0

  const firstUnopenedId = unopenedBonuses[0]?.id
  const currentBonus = unopenedBonuses[0]
  const upNextBonuses = unopenedBonuses.slice(1, 4)
  const openedBonuses = [...completedHunts].reverse()
  const bonusNumbers = new Map(hunts.map((hunt, index) => [hunt.id, index + 1]))

  const displayBonuses = obsViewMode === "opening"
    ? hunts
    : hunts.length > 6
      ? [...hunts, ...hunts, ...hunts, ...hunts, ...hunts]
      : hunts

  const isCollecting = !isOpening

  return (
    <div className="h-screen w-full bg-transparent">
      <div
        className="flex h-full w-full flex-col overflow-hidden p-2 shadow-2xl"
        style={{ backgroundColor: OBS.shell, borderRadius: OBS_RADIUS.shell }}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-2 px-2 pb-2 pt-1">
          <Coins className="h-5 w-5" style={{ color: OBS.label }} />
          <h1 className="text-[17px] font-bold text-white">Bonus Hunt</h1>
        </div>

        {/* Statistics */}
        <div className="px-2 py-2 space-y-1.5 text-sm flex-shrink-0">
          <div className="flex justify-between">
            <span className="text-gray-400">B.E. X</span>
            <span className="text-white font-semibold">{breakEvenX.toFixed(1)}x</span>
          </div>
          {!isCollecting && (
            <div className="flex justify-between">
              <span className="text-gray-400">Avg X</span>
              <span className="text-white font-semibold">{averageMultiplier.toFixed(0)}x</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Target</span>
            <span className="text-white font-semibold">${startingBalance.toLocaleString()}</span>
          </div>
          {!isCollecting && (
            <div className="flex justify-between">
              <span className="text-gray-400">Total</span>
              <span className="text-white font-semibold">${totalWinsSoFar.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">{isCollecting ? "Bonuses" : "Bonus"}</span>
            <span className="text-white font-semibold flex items-center gap-1.5">
              {completedHunts.length} / {totalBonuses}
              {superBonuses.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  {superBonuses.length}
                </span>
              )}
            </span>
          </div>
          {!isCollecting && (
            <div className="relative h-1.5 bg-[#0B0E13] rounded-full overflow-hidden mt-1">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#7C5CFF] to-[#4D84FF] transition-all duration-1000 ease-out"
                style={{ width: `${totalBonuses > 0 ? (completedHunts.length / totalBonuses) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>

        {isCollecting ? (
          // Collecting phase: grid of full, uncropped slot thumbnails
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[#7FB3FF] text-xs font-semibold uppercase tracking-wide px-2 pt-2 mb-2 flex-shrink-0">
              Slot List
            </div>
            <div ref={collectingScrollRef} className="px-2 pb-3 flex-1 min-h-0 overflow-y-auto hide-scrollbar">
              <div className="grid grid-cols-3 gap-2">
                {hunts.map((hunt, index) => (
                  <div
                    key={hunt.id}
                    className="relative aspect-[180/236] rounded-lg bg-[#0B0E13] border border-[#4D84FF]/20 overflow-hidden flex items-center justify-center"
                  >
                    {hunt.image_url ? (
                      <img
                        src={hunt.image_url || "/placeholder.svg"}
                        alt={hunt.game_name}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Coins className="w-6 h-6 text-[#4D84FF]/40" />
                    )}
                    <span className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-[#4D84FF] text-white text-[11px] font-bold shadow">
                      {index + 1}
                    </span>
                    {hunt.is_super && (
                      <Crown className="absolute top-1 right-1 w-4 h-4 text-amber-400 drop-shadow" />
                    )}
                  </div>
                ))}
                {hunts.length === 0 && (
                  <div className="col-span-3 text-center text-gray-400 text-sm py-6">No bonuses collected yet</div>
                )}
                {hunts.length > 15 &&
                  hunts.map((hunt, index) => (
                    <div
                      key={`${hunt.id}-dup`}
                      aria-hidden="true"
                      className="relative aspect-[180/236] rounded-lg bg-[#0B0E13] border border-[#4D84FF]/20 overflow-hidden flex items-center justify-center"
                    >
                      {hunt.image_url ? (
                        <img
                          src={hunt.image_url || "/placeholder.svg"}
                          alt=""
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Coins className="w-6 h-6 text-[#4D84FF]/40" />
                      )}
                      <span className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-[#4D84FF] text-white text-[11px] font-bold shadow">
                        {index + 1}
                      </span>
                      {hunt.is_super && (
                        <Crown className="absolute top-1 right-1 w-4 h-4 text-amber-400 drop-shadow" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          // Opening phase: best win, up next, and opened bonuses with full thumbnails
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar animate-in fade-in duration-500">
            {/* Best X Win */}
            <div className="px-2 py-3 border-b border-[#4D84FF]/20">
              <div className="text-[#7FB3FF] text-xs font-semibold uppercase tracking-wide mb-2">Best X Win</div>
              {highestWin.amount > 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#4D84FF]/15 to-transparent border border-[#4D84FF]/30 p-2 animate-in fade-in slide-in-from-bottom-1 duration-500">
                  <div className="h-14 aspect-[180/236] flex-shrink-0 rounded-md bg-[#0B0E13] border border-[#4D84FF]/20 overflow-hidden flex items-center justify-center">
                    {hunts.find((h) => h.game_name === highestWin.game)?.image_url ? (
                      <img
                        src={hunts.find((h) => h.game_name === highestWin.game)?.image_url || "/placeholder.svg"}
                        alt={highestWin.game}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Coins className="w-5 h-5 text-[#4D84FF]/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{highestWin.game}</div>
                    <div className="text-gray-400 text-xs">${highestWin.betSize.toFixed(2)} bet</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[#B18CFF] font-bold text-base">{highestWinMultiplier.toFixed(0)}x</div>
                    <div className="text-white text-xs font-medium">${highestWin.amount.toFixed(2)}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-[#4D84FF]/20 py-3">
                  <span className="text-gray-500 text-xs font-medium">Awaiting Opening</span>
                </div>
              )}
            </div>

            {/* Up Next */}
            {(currentBonus || upNextBonuses.length > 0) && (
              <div className="px-2 py-3 border-b border-[#4D84FF]/20 space-y-2">
                <div className="text-[#7FB3FF] text-xs font-semibold uppercase tracking-wide">Up Next</div>
                <AnimatePresence mode="popLayout" initial={false}>
                  {currentBonus && (
                    <motion.div
                      key={currentBonus.id}
                      id={`bonus-${currentBonus.id}`}
                      layout
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      className="flex items-center gap-3 rounded-lg bg-[#4D84FF]/20 border border-[#4D84FF]/50 p-2"
                    >
                      <div className="relative h-12 aspect-[180/236] flex-shrink-0 rounded-md bg-[#0B0E13] border border-[#4D84FF]/20 overflow-hidden flex items-center justify-center">
                        {currentBonus.image_url ? (
                          <img
                            src={currentBonus.image_url || "/placeholder.svg"}
                            alt={currentBonus.game_name}
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Coins className="w-4 h-4 text-[#4D84FF]/40" />
                        )}
                        <span className="absolute top-0.5 left-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#8B5CF6] text-white text-[9px] font-bold shadow">
                          {bonusNumbers.get(currentBonus.id)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {currentBonus.is_super && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                          <span className="text-white font-medium text-sm truncate">{currentBonus.game_name}</span>
                        </div>
                        <div className="text-gray-400 text-xs">${currentBonus.bet_size.toFixed(2)}</div>
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-white bg-[#8B5CF6] rounded px-1.5 py-0.5 animate-pulse">
                        Opening
                      </span>
                    </motion.div>
                  )}
                  {upNextBonuses.map((hunt) => (
                    <motion.div
                      key={hunt.id}
                      layout
                      initial={{ opacity: 0, y: -16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="flex items-center gap-3 rounded-lg px-2 py-1"
                    >
                      <div className="relative h-11 aspect-[180/236] flex-shrink-0 rounded-md bg-[#0B0E13] border border-[#4D84FF]/20 overflow-hidden flex items-center justify-center">
                        {hunt.image_url ? (
                          <img
                            src={hunt.image_url || "/placeholder.svg"}
                            alt={hunt.game_name}
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Coins className="w-3.5 h-3.5 text-[#4D84FF]/40" />
                        )}
                        <span className="absolute top-0.5 left-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#3F3355] text-gray-300 text-[9px] font-bold shadow">
                          {bonusNumbers.get(hunt.id)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {hunt.is_super && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                          <span className="text-gray-300 text-sm truncate">{hunt.game_name}</span>
                        </div>
                        <div className="text-gray-500 text-xs">${hunt.bet_size.toFixed(2)}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Opened */}
            {openedBonuses.length > 0 && (
              <div ref={scrollContainerRef} className="px-2 py-3 space-y-2">
                <div className="text-[#7FB3FF] text-xs font-semibold uppercase tracking-wide">Opened</div>
                <AnimatePresence mode="popLayout" initial={false}>
                  {openedBonuses.map((hunt) => {
                    const multiplier = hunt.result && hunt.bet_size ? Number(hunt.result) / Number(hunt.bet_size) : 0
                    const isBestWin = hunt.game_name === highestWin.game && Number(hunt.result) === highestWin.amount
                    return (
                      <motion.div
                        key={hunt.id}
                        id={`bonus-${hunt.id}`}
                        layout
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        className="flex items-center gap-3 rounded-lg px-2 py-1"
                      >
                        <div className="relative h-11 aspect-[180/236] flex-shrink-0 rounded-md bg-[#0B0E13] border border-[#4D84FF]/20 overflow-hidden flex items-center justify-center">
                          {hunt.image_url ? (
                            <img
                              src={hunt.image_url || "/placeholder.svg"}
                              alt={hunt.game_name}
                              crossOrigin="anonymous"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Coins className="w-3.5 h-3.5 text-[#4D84FF]/40" />
                          )}
                          <span className="absolute top-0.5 left-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#3F3355] text-gray-300 text-[9px] font-bold shadow">
                            {bonusNumbers.get(hunt.id)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            {hunt.is_super && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                            <span className="text-white text-sm truncate">{hunt.game_name}</span>
                          </div>
                          <div className="text-gray-500 text-xs">${Number(hunt.bet_size).toFixed(2)}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div
                            className={`text-xs font-semibold ${isBestWin ? "text-emerald-400" : "text-gray-300"}`}
                          >
                            {multiplier.toFixed(1)}x
                          </div>
                          <div className={`text-xs font-semibold ${isBestWin ? "text-emerald-400" : "text-white"}`}>
                            ${Number(hunt.result).toFixed(2)}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}

            {totalBonuses === 0 && (
              <div className="text-center text-gray-400 text-sm py-6">No bonuses in this hunt yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
