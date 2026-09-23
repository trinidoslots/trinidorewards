"use client"

import { createClient } from "@/lib/supabase/client"
import { getActiveHunt } from "@/lib/active-hunt"
import { Coins, Crown } from "lucide-react"
import { Suspense, useEffect, useLayoutEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { OBS, OBS_FONT, OBS_RADIUS, shellBackground } from "@/lib/obs-theme"

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
  /*
    The overlay's typeface, stated rather than inherited.

    The site's body carries Geist, so this column was set in Geist while the
    casino bar next to it was set in Inter — two faces in one overlay, which
    is what it looked like. It is spread from here alongside the accents so
    the loading state and the widget cannot end up on different fonts.
  */
  fontFamily: OBS_FONT,
} as React.CSSProperties

/**
 * A figure in dollars.
 *
 * Whole dollars: a hunt's numbers run to five figures and the cents on a
 * $53,220 win are noise. Under a dollar is the exception — a $0.40 bet rounded
 * to the nearest dollar is "$0", which is not a bet size — so anything below 1
 * keeps both decimals.
 */
const money = (value: number) =>
  value > 0 && value < 1 ? `$${value.toFixed(2)}` : `$${Math.round(value).toLocaleString("en-US")}`

/**
 * Height of one bonus card, and the leading of the four lines inside it.
 *
 * Fixed so the cover can fill it. 66 was exactly four lines with nothing to
 * spare, which is why the card looked squeezed: the text ran wall to wall
 * with no air above or below it.
 *
 * 92 leaves 86px inside the padding and the border, and the cover is 86 tall
 * by 66 wide. The three stat rows take CARD_LINE each — label and figure are
 * the same size, so the line box is the leading and nothing more — plus two
 * CARD_ROW_GAPs between them, which is 61 centred in 86.
 *
 * The gap wants to be small. On the leading alone the three rows read as one
 * block of text, but 9 pushed them apart far enough that they stopped reading
 * as a group at all; 5 separates them without scattering them. The height
 * stays at 92 either way — what is left over becomes air around the figures,
 * which is the part that stopped the card looking squeezed.
 *
 * TO_OPEN_HEIGHT below is derived from this, so a cover is one size in this
 * column and not two that differ by a few pixels.
 */
const CARD_HEIGHT = 92
const CARD_LINE = 17
const CARD_ROW_GAP = 5

/**
 * The "to open" row: five whole covers, each one sliding in behind the last.
 *
 * Every cover is the same: full height, full 180:236 shape, nothing cropped
 * and nothing shrunk. What makes the four behind the lead read as narrow is
 * that most of each is under its neighbour — they are stacked, not resized.
 *
 * The widths are not written down anywhere. The lead is the only item with a
 * width of its own; the four behind it are flex items sharing what is left of
 * the row, and each one's cover hangs out of its slot to the left by however
 * much does not fit. So the row always ends flush with the cards below it and
 * the overlap is whatever that costs — at 214px wide, 59px covers showing
 * 31px each.
 *
 * The height is the card's inside height (CARD_HEIGHT less its 4px of padding
 * and 2px of border), so this cover and the one on a card below are the same
 * size rather than two sizes that happen to be close.
 */
const TO_OPEN_SHOWN = 5
const TO_OPEN_HEIGHT = CARD_HEIGHT - 6
const TO_OPEN_WIDTH = Math.round((TO_OPEN_HEIGHT * 180) / 236)

/**
 * The number on a cover.
 *
 * A rounded square in the corner rather than the circle it was: a circle on a
 * rectangular cover reads as a sticker, and at 11px the digits in one were
 * touching its edge. Shared so the slot list cannot drift back to the circle
 * while the opening cards use this — which is exactly what had happened.
 */
const RANK_BADGE =
  "absolute left-0.5 top-0.5 flex items-center justify-center rounded bg-black/70 px-1 font-bold text-white"
const RANK_BADGE_STYLE = { minWidth: 15, height: 15, fontSize: 10, lineHeight: "15px" } as const

/**
 * How a label and its figure are set, everywhere in this column.
 *
 * Labels used to be white at 25–35%, which over a translucent column on a
 * moving capture is not a colour at all — it is whatever happens to be behind
 * it, shifted. Both sides are white at full strength now and the same size,
 * and the whole distinction is carried by weight: 300 against 600.
 *
 * In one place because it was not. The statistics panel had five rows each
 * carrying its own copy of the old grey, and the cards had their own — which
 * is how the two halves of one widget come to be set differently.
 *
 * The label truncates and the figure does not: a row short of room should
 * clip three letters rather than push out the number it exists to show.
 */
const LABEL_CLASS = "min-w-0 truncate text-white"
const LABEL_STYLE = { fontWeight: 300 } as const
const VALUE_CLASS = "shrink-0 font-semibold text-white"

/** How fast the slot list creeps past, in pixels per second. */
const MARQUEE_SPEED = 24
/** A moment to read the top of the list before it starts moving. */
const MARQUEE_DELAY_MS = 1500

/**
 * Creeps a list past its window, forever, by moving it rather than scrolling it.
 *
 * This was `container.scrollTop += 0.4` once a frame, and that is why the slot
 * list juddered. `scrollTop` is quantised to whole pixels: set it to 0.4, 0.8,
 * 1.2, 1.6, 2.0 and it reads back 0, 1, 1, 2, 2 — so the list stands still for
 * a frame or two and then jumps a whole pixel. Measured, the painted movement
 * per frame went −1, 0, −1, 0, 0, −1, 0. That irregular hop is the judder; the
 * frames themselves were always on time.
 *
 * A transform has no such rounding. The same 0.4 a frame comes out as a clean
 * −0.4 every frame, and it is handed to the compositor rather than triggering
 * layout.
 *
 * Time-based, too. A fixed step per frame is a different speed on every
 * refresh rate — 0.4 a frame is 24px/s at 60Hz and 58px/s at 144 — and a
 * dropped frame silently shortens the travel.
 *
 * `track` holds two copies of the list stacked, so the loop point is where the
 * second one starts. Measured from their offsets rather than by halving the
 * total height: at two tiles across, an odd number of slots does not make two
 * copies exactly twice as tall as one, and halving would have put the seam in
 * the wrong place.
 */
function useMarquee(
  track: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  deps: React.DependencyList,
) {
  useEffect(() => {
    const element = track.current
    if (!enabled || !element) return

    const first = element.children[0] as HTMLElement | undefined
    const second = element.children[1] as HTMLElement | undefined
    if (!first || !second) return

    const loopPoint = second.offsetTop - first.offsetTop
    if (loopPoint <= 0) return

    let offset = 0
    let previous = 0
    let startedAt = 0
    let frame = 0

    const step = (now: number) => {
      if (startedAt === 0) {
        startedAt = now
        previous = now
      }

      const elapsed = now - previous
      previous = now

      if (now - startedAt > MARQUEE_DELAY_MS) {
        offset = (offset + (MARQUEE_SPEED * elapsed) / 1000) % loopPoint
        element.style.transform = `translate3d(0, ${-offset}px, 0)`
      }

      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      element.style.transform = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, track, ...deps])
}

/**
 * A game's thumbnail with its position in the hunt on it.
 *
 * Width comes from the 180:236 cover shape unless one is given. Given one, the
 * artwork crops to it — `object-cover` keeps the middle of the picture at full
 * height rather than squashing the whole thing into a narrower box.
 */
function BonusThumb({
  hunt,
  height,
  width,
  rank,
  lifted,
  lead,
}: {
  hunt: BonusHunt
  /** A number of pixels, or "100%" to fill a parent of definite height. */
  height: number | string
  /** Overrides the cover shape; the artwork is cropped to it. */
  width?: number | string
  rank?: number
  /** Casts a shadow to its right, onto whatever it is lying on top of. */
  lifted?: boolean
  /** The next one to be opened: ringed in white so it is picked out. */
  lead?: boolean
}) {
  /*
    Both shadows at once on the lead cover, white first.

    They overlap along its right edge, where the glow spreads out and the drop
    shadow falls across the cover behind. A box-shadow list paints in order
    with the first on top, so putting the glow first keeps the ring reading
    white there instead of being muddied by the black underneath it.
  */
  const shadows = [
    lead ? "0 0 6px 1px rgba(255, 255, 255, 0.4)" : null,
    // Offset right with a negative spread: the shadow falls on the cover
    // behind this one and barely bleeds above or below it, which is what
    // makes the row read as a stack rather than as a flat row that happens
    // to be clipped.
    lifted ? "5px 0 10px -1px rgba(0, 0, 0, 0.6)" : null,
  ].filter(Boolean)

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.022]"
      style={{
        ...(width === undefined ? { height, aspectRatio: "180 / 236" } : { height, width }),
        // Border-box, so the ring thickens inward and the cover keeps the
        // same outer size whether it is the lead or not.
        border: lead ? "2px solid #FFFFFF" : "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: shadows.length > 0 ? shadows.join(", ") : undefined,
      }}
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
        <span className={RANK_BADGE} style={RANK_BADGE_STYLE}>
          {rank}
        </span>
      )}
      {hunt.is_super && (
        <Crown className="absolute right-0.5 top-0.5 h-3 w-3 text-[color:var(--obs-gold)] drop-shadow" />
      )}
    </div>
  )
}

/**
 * One tile in the slot list, before the opening starts.
 *
 * Same cover and same number badge as the opening cards use — this grid was
 * still on the old badge, a filled accent circle, so the two phases of the
 * same hunt numbered their slots two different ways. It cannot reuse
 * BonusThumb: that one is sized by its height, and a grid cell gives its tile
 * a width.
 */
function SlotTile({ hunt, number, duplicate }: { hunt: BonusHunt; number: number; duplicate?: boolean }) {
  return (
    <div
      aria-hidden={duplicate ? "true" : undefined}
      className="relative flex aspect-[180/236] items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.022]"
    >
      {hunt.image_url ? (
        <img
          src={hunt.image_url || "/placeholder.svg"}
          alt={duplicate ? "" : hunt.game_name}
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
        />
      ) : (
        <Coins className="h-6 w-6 text-white/20" />
      )}
      <span className={RANK_BADGE} style={RANK_BADGE_STYLE}>
        {number}
      </span>
      {hunt.is_super && (
        <Crown className="absolute right-0.5 top-0.5 h-4 w-4 text-[color:var(--obs-gold)] drop-shadow" />
      )}
    </div>
  )
}

/**
 * One "Bet $300" line: muted label on the left, figure hard right.
 *
 * Line height is fixed rather than inherited. The card is a fixed height now so
 * the cover can fill it, and four lines of inherited leading do not reliably
 * add up to the same thing.
 */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2" style={{ lineHeight: `${CARD_LINE}px` }}>
      <span className={`${LABEL_CLASS} text-[13px]`} style={LABEL_STYLE}>
        {label}
      </span>
      <span className={`${VALUE_CLASS} text-[13px] tabular-nums`}>{value}</span>
    </div>
  )
}

/**
 * One line of the statistics panel at the top of the column.
 *
 * The panel sets its own size, so no size is named here — that is what keeps
 * these rows and the cards' rows agreeing on everything except the size the
 * two places actually want to differ on.
 *
 * The figure is an inline-flex so the Bonus row can put the crown and its
 * count beside the tally without needing a row of its own.
 */
function KpiRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={LABEL_CLASS} style={LABEL_STYLE}>
        {label}
      </span>
      <span className={`${VALUE_CLASS} inline-flex items-center gap-1.5`}>{children}</span>
    </div>
  )
}

/**
 * A bonus as a card: cover on the left, its figures stacked on the right.
 *
 * One card, one look. It used to tint itself three ways — the one being
 * opened in violet, the best win in blue, the rest plain — so a list of opened
 * bonuses read as a list of unrelated things with one of them singled out for
 * no reason the viewer can see. The surface is the KPI box's surface exactly,
 * which makes every box in the column the same material.
 *
 * The cover sits 2px off the edge, not 6. At 6 it read as a small picture
 * placed on a large card; the card is a frame around the cover.
 */
function BonusCard({ hunt, rank }: { hunt: BonusHunt; rank?: number }) {
  const bet = Number(hunt.bet_size) || 0
  const win = hunt.result == null ? null : Number(hunt.result)
  const multiplier = win != null && bet > 0 ? win / bet : null

  return (
    <div
      className="flex items-stretch gap-2 rounded-xl p-0.5 pr-2"
      style={{
        height: CARD_HEIGHT,
        border: `1px solid ${OBS.raisedBorder}`,
        backgroundImage: OBS.raised,
        boxShadow: OBS.raisedInset,
      }}
    >
      {/* Fills the card's height; the 180:236 cover gives it its width. */}
      <BonusThumb hunt={hunt} height="100%" rank={rank} />
      {/*
        No game name. The cover is the name — it is the thing a viewer
        recognises, and spelling it out underneath was a line of small text
        saying what the picture beside it already said, often truncated.
        Without it the three figures are what the card is for, so they sit
        centred against the cover rather than hanging off the top of it.
      */}
      <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ gap: CARD_ROW_GAP }}>
        <StatRow label="Bet" value={money(bet)} />
        <StatRow label="X" value={multiplier == null ? "—" : `${multiplier.toFixed(0)}x`} />
        <StatRow label="Win" value={win == null ? "—" : money(win)} />
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
  /** The moving track inside that window — two copies of the slot list. */
  const marqueeRef = useRef<HTMLDivElement>(null)
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

  /*
    There used to be a second scroll loop here, for the opened list in
    "normal" view mode. It ran at 60fps and did nothing at all.

    Its container was `scrollContainerRef`, which is on the opened list itself
    — a plain div with no overflow, sitting inside the element that actually
    scrolls. Writing `scrollTop` to it moved nothing, and its stop position
    was `scrollHeight / 5 * 4`, a fifth of the height because the list used to
    be rendered five times over. It has not been for a long time.

    What it did do was read `container.scrollHeight` inside the animation
    frame. Reading that forces the browser to lay the document out before it
    can answer, so this loop made the whole page re-layout sixty times a
    second to compute a number it then threw away. In /obs/complete that cost
    is paid by everything: the three sources are same-origin frames and share
    one main thread with the scene behind them, so a column quietly forcing
    layout at 60fps is why the top bar and the other column stuttered too.
  */

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

  // loopList gates it, so the scroll restarts when the duplicate goes in.
  useMarquee(marqueeRef, !isOpening && loopList, [hunts.length, loopList])

  useEffect(() => {
    if (obsViewMode !== "opening") return

    const container = scrollContainerRef.current
    if (!container) return

    /*
      The bonus that has just been opened.

      This used to follow the next *un*opened one, back when that had a card of
      its own. It has not had one since the "Opening" card was dropped, so the
      lookup below found nothing and the column stopped following the hunt at
      all. The newest opened card is the one that moves, and it goes in at the
      top of the list, so that is what to stay on.
    */
    const lastOpened = [...hunts].reverse().find((h) => h.result && h.result > 0)
    if (!lastOpened) return

    if (lastScrolledBonusRef.current === lastOpened.id) return

    lastScrolledBonusRef.current = lastOpened.id

    /*
      The list, not the card.

      It used to scroll the new card itself into view, and that card is the
      one framer-motion is animating into place at that exact moment. A smooth
      scroll works out where to stop from where its target is when it starts,
      so it was aiming at something still moving, overshooting, and being
      corrected — which looks like the scroll stuttering.

      The section around the list does not move. The newest card is at the top
      of it either way, since the list runs newest first.
    */
    container.scrollIntoView({ behavior: "smooth", block: "start" })
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

  const openedBonuses = [...completedHunts].reverse()
  const bonusNumbers = new Map(hunts.map((hunt, index) => [hunt.id, index + 1]))

  /**
   * The slot list, newest first.
   *
   * The numbers still count the opening order — the bonus added first is still
   * #1 and still opens first. Only the reading order is flipped, so the one
   * just added is at the top of the column where it can be seen going in,
   * instead of at the bottom of a list that has to scroll to reach it.
   */
  const slotList = hunts.map((hunt, index) => ({ hunt, number: index + 1 })).reverse()

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
            Bonus Hunt{huntTitle ? ` ${/^\d+$/.test(huntTitle) ? "#" : ""}${huntTitle}` : ""}
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
        <div className="flex-shrink-0 px-2 pb-1">
          <div
            className="space-y-1.5 rounded-2xl px-2.5 py-2 text-sm"
            style={{
              backgroundImage: OBS.raised,
              border: `1px solid ${OBS.raisedBorder}`,
              boxShadow: OBS.raisedInset,
            }}
          >
            <KpiRow label="B.E. X">{breakEvenX.toFixed(1)}x</KpiRow>
            <KpiRow label="Avg X">{averageMultiplier.toFixed(0)}x</KpiRow>
            <KpiRow label="Target">{money(startingBalance)}</KpiRow>
            <KpiRow label="Total">{money(totalWinsSoFar)}</KpiRow>
            {/* Just the tally. The super count used to ride along here behind
                a crown, which put two unrelated numbers on one line — the
                covers already carry a crown each, so the panel was repeating
                what the list below it shows. */}
            <KpiRow label="Bonus">
              {completedHunts.length} / {totalBonuses}
            </KpiRow>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-black/30 mt-1">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[color:var(--obs-super)] to-[color:var(--obs-accent)] transition-all duration-1000 ease-out"
                style={{ width: `${totalBonuses > 0 ? (completedHunts.length / totalBonuses) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {isCollecting ? (
          // Collecting phase: grid of full, uncropped slot thumbnails
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[color:var(--obs-accent)] text-xs font-semibold uppercase tracking-wide px-2 pt-2 mb-2 flex-shrink-0">
              Slot List
            </div>
            {/*
              The window the list creeps past. It does not scroll any more —
              the track inside it is moved instead, see useMarquee.
            */}
            <div ref={collectingScrollRef} className="px-2 pb-3 flex-1 min-h-0 overflow-hidden">
              <div ref={marqueeRef} className="space-y-2" style={{ willChange: "transform" }}>
                {/*
                    Two across, at the size the tiles have always been.

                    Measured off the old layout: a 300px box, 12px of list
                    padding each side and two 8px gaps put three tiles at
                    86.66 wide. Keeping that size and going to two across is
                    what sets the column width — 87 + 8 + 87, plus 8px of list
                    padding and 8px of shell padding each side, is 214.
                    Widening the tiles instead would have doubled them to 180,
                    which is bigger than they have ever been.

                    The duplicate is a grid of its own rather than more cells
                    in this one. Two copies in a single grid do not make it
                    exactly twice as tall when the slot count is odd — five
                    slots are three rows, ten are five — so the loop point
                    could not be found by halving.
                */}
                <div className="grid grid-cols-2 gap-2">
                  {slotList.map(({ hunt, number }) => (
                    <SlotTile key={hunt.id} hunt={hunt} number={number} />
                  ))}
                  {hunts.length === 0 && (
                    <div className="col-span-2 text-center text-white/35 text-sm py-6">No bonuses collected yet</div>
                  )}
                </div>

                {loopList && (
                  <div className="grid grid-cols-2 gap-2">
                    {slotList.map(({ hunt, number }) => (
                      <SlotTile key={`${hunt.id}-dup`} hunt={hunt} number={number} duplicate />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /*
            Opening phase, read top to bottom as the hunt runs:

              best X win      the one to beat, at the top where it stays put
              still to open   a deck of covers, dealt off the left
              already opened  cards falling away downwards, newest first

            No card for the bonus currently being opened. It had one, sitting
            between the deck and the list, and it was the wrong thing to draw:
            the bonus on screen is the one on screen. Repeating its cover in
            the column while the stream shows it full size took the room that
            the results — the part a viewer cannot get anywhere else — need.

            The shape carries the progress instead: the deck above shortens,
            the list below grows.
          */
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar animate-in fade-in duration-500">
            {/* Best X Win */}
            <div className="border-b border-white/[0.08] px-2 py-2.5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--obs-accent)]">
                Best X Win
              </div>
              {bestWinHunt ? (
                <BonusCard hunt={bestWinHunt} rank={bonusNumbers.get(bestWinHunt.id)} />
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-white/[0.08] py-3">
                  <span className="text-xs font-medium text-white/25">Awaiting Opening</span>
                </div>
              )}
            </div>

            {/*
              Still to open: the next one in full, the four after it sliding
              in behind it.

              Two earlier versions got the depth wrong. Stepping the covers
              down in height left the fifth at 30px with an unreadable number
              on it, and a row of five sizes reads as five kinds of thing.
              Cutting them into separate boxes with gaps between them made
              five things side by side — the queue was there but the order
              was not, because nothing said which came before which.

              Overlap says it: the lead is whole, each one after it is partly
              under the one in front, so the row is read left to right by its
              shape alone. Only the lead carries a number — on the others the
              badge sits in the covered part by construction.
            */}
            {unopenedBonuses.length > 0 && (
              <div className="border-b border-white/[0.08] px-2 py-2.5">
                <div className="mb-1.5 flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--obs-accent)]">
                    To open
                  </span>
                  {/* A figure, not a placeholder, so it gets the same white
                      as every other figure in the column rather than the 25%
                      grey it was. */}
                  <span className="text-[11px] text-white" style={LABEL_STYLE}>
                    {unopenedBonuses.length}
                  </span>
                </div>
                <div className="flex items-start">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {unopenedBonuses.slice(0, TO_OPEN_SHOWN).map((hunt, index) => (
                      <motion.div
                        key={hunt.id}
                        layout
                        className="relative"
                        style={{
                          height: TO_OPEN_HEIGHT,
                          // Front-most first, so each cover is drawn over the
                          // one after it rather than under it.
                          zIndex: TO_OPEN_SHOWN - index,
                          // The lead gets its own width; the rest divide up
                          // what is left, which is what sets the overlap.
                          ...(index === 0
                            ? { flex: "none", width: TO_OPEN_WIDTH }
                            : { flex: "1 1 0", minWidth: 0 }),
                        }}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        {/* A whole cover pinned to the right of a slot too
                            narrow for it, so it hangs back under its
                            neighbour instead of being squeezed. */}
                        <div className="absolute right-0 top-0 h-full" style={{ width: TO_OPEN_WIDTH }}>
                          <BonusThumb
                            hunt={hunt}
                            height="100%"
                            width="100%"
                            lifted
                            lead={index === 0}
                            rank={index === 0 ? bonusNumbers.get(hunt.id) : undefined}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
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
                      <BonusCard hunt={hunt} rank={bonusNumbers.get(hunt.id)} />
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
