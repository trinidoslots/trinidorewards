"use client"

import { createClient } from "@/lib/supabase/client"
import { getActiveHunt } from "@/lib/active-hunt"
import { Coins, Crown } from "lucide-react"
import { Suspense, useEffect, useLayoutEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { OBS, OBS_RADIUS, shellBackground } from "@/lib/obs-theme"

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

/**
 * The widget's accents, read by every descendant through var().
 *
 * Declared in one place and spread into both shells rather than typed in at
 * the thirty-odd spots that want them, which is how this widget stayed on the
 * old blue while the rest of the overlay moved.
 */
const ACCENT_VARS = {
  ["--obs-accent" as string]: OBS.label,
  ["--obs-super" as string]: OBS.giveaway,
  ["--obs-gold" as string]: OBS.prediction,
} as React.CSSProperties

const money = (value: number) =>
  `$${Math.round(value).toLocaleString("en-US")}`

/**
 * A game's thumbnail with its position in the hunt on it.
 *
 * The number is a rounded square in the corner rather than the circle it was:
 * a circle on a rectangular cover reads as a sticker, and at 11px the digits
 * in one were touching its edge.
 */
function BonusThumb({
  hunt,
  height,
  rank,
  dim,
}: {
  hunt: BonusHunt
  height: number
  rank?: number
  dim?: boolean
}) {
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.022]"
      style={{ height, aspectRatio: "180 / 236", opacity: dim ? 0.55 : 1 }}
    >
      {hunt.image_url ? (
        <img
          src={hunt.image_url || "/placeholder.svg"}
          alt={hunt.game_name}
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
        />
      ) : (
        <Coins className="h-4 w-4 text-white/20" />
      )}
      {rank !== undefined && (
        <span
          className="absolute left-0.5 top-0.5 flex items-center justify-center rounded bg-black/70 px-1 font-bold text-white"
          style={{ minWidth: 15, height: 15, fontSize: 10, lineHeight: "15px" }}
        >
          {rank}
        </span>
      )}
      {hunt.is_super && (
        <Crown className="absolute right-0.5 top-0.5 h-3 w-3 text-[color:var(--obs-gold)] drop-shadow" />
      )}
    </div>
  )
}

/** One "Bet $300" line: muted label on the left, figure hard right. */
function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-white/35">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: accent ?? "#fff" }}>
        {value}
      </span>
    </div>
  )
}

/**
 * A bonus as a card: cover on the left, its figures stacked on the right.
 *
 * One component for all three states — the one being opened, the ones already
 * opened, and the best win — because they are the same card at different
 * emphases, and three near-identical blocks is how the old layout ended up
 * with three slightly different thumbnails and three badge styles.
 */
function BonusCard({
  hunt,
  rank,
  tone,
  note,
}: {
  hunt: BonusHunt
  rank?: number
  tone: "current" | "opened" | "best"
  note?: string
}) {
  const bet = Number(hunt.bet_size) || 0
  const win = hunt.result == null ? null : Number(hunt.result)
  const multiplier = win != null && bet > 0 ? win / bet : null

  const border =
    tone === "current"
      ? "1px solid color-mix(in srgb, var(--obs-super) 55%, transparent)"
      : tone === "best"
        ? "1px solid color-mix(in srgb, var(--obs-accent) 40%, transparent)"
        : "1px solid rgba(255,255,255,0.08)"

  return (
    <div
      className="flex items-center gap-2.5 rounded-lg p-1.5"
      style={{
        border,
        background:
          tone === "current"
            ? "color-mix(in srgb, var(--obs-super) 14%, transparent)"
            : tone === "best"
              ? "color-mix(in srgb, var(--obs-accent) 10%, transparent)"
              : "rgba(255,255,255,0.022)",
      }}
    >
      <BonusThumb hunt={hunt} height={tone === "current" ? 64 : 56} rank={rank} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 truncate text-[12px] font-medium text-white/80">{hunt.game_name}</div>
        <StatRow label="Bet" value={money(bet)} />
        <StatRow label="X" value={multiplier == null ? "—" : `${multiplier.toFixed(0)}x`} />
        <StatRow
          label={note ? "" : "Win"}
          value={note ?? (win == null ? "—" : money(win))}
          accent={tone === "best" ? "var(--obs-super)" : undefined}
        />
      </div>
    </div>
  )
}

function HuntWidget() {
  // Set by /obs/complete, which paints the column's gradient itself.
  const isTransparent = useSearchParams().get("transparent") === "1"
  const [hunts, setHunts] = useState<BonusHunt[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpening, setIsOpening] = useState(false)
  const [obsViewMode, setObsViewMode] = useState<"opening" | "normal">("opening")
  const [huntSource, setHuntSource] = useState<"integrated" | "external">("integrated")
  const [externalHuntStatus, setExternalHuntStatus] = useState<string | null>(null)
  const [startingBalance, setStartingBalance] = useState(0)
  // The hunt's own name, for the header. Null until one is loaded, and
  // null for an external hunt, which has no record here to name.
  const [huntTitle, setHuntTitle] = useState<string | null>(null)
  const supabase = createClient()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const collectingScrollRef = useRef<HTMLDivElement>(null)
  /**
   * Whether the slot list is taller than the space it has, and so needs the
   * second copy that makes the scroll loop seamlessly.
   *
   * This was "more than 15 slots", which was a count that happened to be right
   * for three tiles across. At two across the same 15 slots are eight rows
   * instead of five, and slots nine onwards sat below the fold with no scroll
   * to reach them. Measured instead, so it holds at any width, any tile size
   * and any source height.
   */
  const [loopList, setLoopList] = useState(false)
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
        setHuntTitle(null)
        setLoading(false)
        return
      }

      setStartingBalance(Number(activeHunt.starting_balance))
      setHuntTitle(activeHunt.title?.trim() || null)

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

  useLayoutEffect(() => {
    setLoopList(false)
  }, [hunts.length, isOpening])

  useLayoutEffect(() => {
    if (loopList || isOpening) return
    const container = collectingScrollRef.current
    if (!container) return
    // One copy is on screen at this point; if it already does not fit, the
    // duplicate goes in and the scroll below takes over.
    if (container.scrollHeight > container.clientHeight + 1) setLoopList(true)
  }, [loopList, isOpening, hunts])

  useEffect(() => {
    if (isOpening) return
    if (!loopList) return

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
    // loopList gates this, so the scroll has to restart when it flips.
  }, [isOpening, hunts.length, loopList])

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
          style={{
          backgroundColor: shellBackground(isTransparent),
          borderRadius: OBS_RADIUS.shell,
          ...ACCENT_VARS,
        }}
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

  /**
   * The bonus with the biggest multiple, as a row rather than a summary.
   *
   * Was three loose fields — game name, amount, bet — matched back to a row by
   * comparing the name, which quietly picked the wrong one whenever the same
   * game appeared in a hunt twice. Keeping the row itself removes the lookup,
   * and "Best X Win" is a multiple, so it is chosen by multiple: the old one
   * took the biggest cash win, which is a different bonus whenever a larger
   * bet paid less.
   */
  const bestWinHunt = completedHunts.reduce<BonusHunt | null>((best, hunt) => {
    const bet = Number(hunt.bet_size) || 0
    const win = Number(hunt.result) || 0
    if (bet <= 0 || win <= 0) return best
    if (!best) return hunt
    return win / bet > Number(best.result) / Number(best.bet_size) ? hunt : best
  }, null)

  const currentBonus = unopenedBonuses[0]
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
        style={{
          backgroundColor: shellBackground(isTransparent),
          borderRadius: OBS_RADIUS.shell,
          ...ACCENT_VARS,
        }}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-2 px-2 pb-2 pt-1">
          <Coins className="h-5 w-5" style={{ color: OBS.label }} />
          {/* The hunt's own name follows "Bonus Hunt", with a # only when
              the name is a bare number — "#1435", but "Bonus Hunt Sunday"
              rather than "Bonus Hunt #Sunday". */}
          <h1 className="truncate text-[17px] font-bold text-white">
            Bonus Hunt{huntTitle ? ` ${/^d+$/.test(huntTitle) ? "#" : ""}${huntTitle}` : ""}
          </h1>
        </div>

        {/*
          The same panel in both phases.

          Avg X, Total and the progress bar used to be hidden while collecting,
          on the reasoning that nothing had been opened yet so they had nothing
          to say. But the panel then changed shape the moment the opening
          started — rows appearing, everything below them moving — and reading
          "Avg X 0x" before a hunt begins is not confusing, it is the starting
          position.
        */}
        <div className="px-2 py-2 space-y-1.5 text-sm flex-shrink-0">
          <div className="flex justify-between">
            <span className="text-white/35">B.E. X</span>
            <span className="text-white font-semibold">{breakEvenX.toFixed(1)}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/35">Avg X</span>
            <span className="text-white font-semibold">{averageMultiplier.toFixed(0)}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/35">Target</span>
            <span className="text-white font-semibold">{money(startingBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/35">Total</span>
            <span className="text-white font-semibold">{money(totalWinsSoFar)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/35">Bonus</span>
            <span className="text-white font-semibold flex items-center gap-1.5">
              {completedHunts.length} / {totalBonuses}
              {superBonuses.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <Crown className="w-3.5 h-3.5 text-[color:var(--obs-gold)]" />
                  {superBonuses.length}
                </span>
              )}
            </span>
          </div>
          <div className="relative h-1.5 bg-white/[0.022] rounded-full overflow-hidden mt-1">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[color:var(--obs-super)] to-[color:var(--obs-accent)] transition-all duration-1000 ease-out"
              style={{ width: `${totalBonuses > 0 ? (completedHunts.length / totalBonuses) * 100 : 0}%` }}
            />
          </div>
        </div>

        {isCollecting ? (
          // Collecting phase: grid of full, uncropped slot thumbnails
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[color:var(--obs-accent)] text-xs font-semibold uppercase tracking-wide px-2 pt-2 mb-2 flex-shrink-0">
              Slot List
            </div>
            <div ref={collectingScrollRef} className="px-2 pb-3 flex-1 min-h-0 overflow-y-auto hide-scrollbar">
              {/*
                  Two across, at the size the tiles have always been.
                  
                  Measured off the old layout: a 300px box, 12px of list
                  padding each side and two 8px gaps put three tiles at
                  86.66 wide. Keeping that size and going to two across is what
                  sets the column width — 87 + 8 + 87, plus 8px of list padding
                  and 8px of shell padding each side, is 214. Widening the
                  tiles instead would have doubled them to 180, which is bigger
                  than they have ever been.
              */}
              <div className="grid grid-cols-2 gap-2">
                {hunts.map((hunt, index) => (
                  <div
                    key={hunt.id}
                    className="relative aspect-[180/236] rounded-lg bg-white/[0.022] border border-white/[0.08] overflow-hidden flex items-center justify-center"
                  >
                    {hunt.image_url ? (
                      <img
                        src={hunt.image_url || "/placeholder.svg"}
                        alt={hunt.game_name}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Coins className="w-6 h-6 text-white/20" />
                    )}
                    <span className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-[color:var(--obs-accent)] text-white text-[11px] font-bold shadow">
                      {index + 1}
                    </span>
                    {hunt.is_super && (
                      <Crown className="absolute top-1 right-1 w-4 h-4 text-[color:var(--obs-gold)] drop-shadow" />
                    )}
                  </div>
                ))}
                {hunts.length === 0 && (
                  <div className="col-span-2 text-center text-white/35 text-sm py-6">No bonuses collected yet</div>
                )}
                {loopList &&
                  hunts.map((hunt, index) => (
                    <div
                      key={`${hunt.id}-dup`}
                      aria-hidden="true"
                      className="relative aspect-[180/236] rounded-lg bg-white/[0.022] border border-white/[0.08] overflow-hidden flex items-center justify-center"
                    >
                      {hunt.image_url ? (
                        <img
                          src={hunt.image_url || "/placeholder.svg"}
                          alt=""
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Coins className="w-6 h-6 text-white/20" />
                      )}
                      <span className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-[color:var(--obs-accent)] text-white text-[11px] font-bold shadow">
                        {index + 1}
                      </span>
                      {hunt.is_super && (
                        <Crown className="absolute top-1 right-1 w-4 h-4 text-[color:var(--obs-gold)] drop-shadow" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          /*
            Opening phase, read top to bottom as the hunt runs:

              still to open   a row that recedes to the right, smallest last
              being opened    one card, front and centre, the only accented one
              already opened  cards falling away downwards, newest first

            The old version had this as three equal lists stacked under
            headings — "Up Next", "Opened" — which said what each was but not
            where the hunt had got to. Here the shape does that: the row above
            shortens, the list below grows, and the card between them is the
            one on screen.
          */
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar animate-in fade-in duration-500">
            {/* Best X Win */}
            <div className="border-b border-white/[0.08] px-2 py-2.5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--obs-accent)]">
                Best X Win
              </div>
              {bestWinHunt ? (
                <BonusCard hunt={bestWinHunt} rank={bonusNumbers.get(bestWinHunt.id)} tone="best" />
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-white/[0.08] py-3">
                  <span className="text-xs font-medium text-white/25">Awaiting Opening</span>
                </div>
              )}
            </div>

            {/*
              Still to open, receding.

              Each one is a little shorter and a little fainter than the one
              before it, so the row reads as going back rather than as a set
              of equals. Six at most: past that they are too small to tell
              apart, and the count beside the heading says how many there are.
            */}
            {unopenedBonuses.length > 0 && (
              <div className="border-b border-white/[0.08] px-2 py-2.5">
                <div className="mb-1.5 flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--obs-accent)]">
                    To open
                  </span>
                  <span className="text-[11px] text-white/25">{unopenedBonuses.length}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {unopenedBonuses.slice(0, 6).map((hunt, index) => (
                      <motion.div
                        key={hunt.id}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        <BonusThumb
                          hunt={hunt}
                          height={46 - index * 4}
                          rank={bonusNumbers.get(hunt.id)}
                          dim={index > 0}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Being opened — the one card that is not part of a list. */}
            {currentBonus && (
              <div className="border-b border-white/[0.08] px-2 py-2.5">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--obs-super)]">
                  Opening
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={currentBonus.id}
                    id={`bonus-${currentBonus.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  >
                    <BonusCard
                      hunt={currentBonus}
                      rank={bonusNumbers.get(currentBonus.id)}
                      tone="current"
                      note="Opening"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* Already opened, falling away downwards. */}
            {openedBonuses.length > 0 && (
              <div ref={scrollContainerRef} className="space-y-1.5 px-2 py-2.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--obs-accent)]">
                  Opened
                </div>
                <AnimatePresence mode="popLayout" initial={false}>
                  {openedBonuses.map((hunt) => (
                    <motion.div
                      key={hunt.id}
                      id={`bonus-${hunt.id}`}
                      layout
                      initial={{ opacity: 0, y: -14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 14 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    >
                      <BonusCard
                        hunt={hunt}
                        rank={bonusNumbers.get(hunt.id)}
                        tone={hunt.id === bestWinHunt?.id ? "best" : "opened"}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}


            {totalBonuses === 0 && (
              <div className="text-center text-white/35 text-sm py-6">No bonuses in this hunt yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function HuntObsWidgetPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="h-screen w-full bg-transparent" />}>
      <HuntWidget />
    </Suspense>
  )
}
