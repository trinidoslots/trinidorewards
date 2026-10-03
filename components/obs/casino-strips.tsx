"use client"

import type { CSSProperties, TransitionEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { BADGE_GRADIENT, BADGE_TEXT, formatMoney, type NowPlayingRow } from "@/lib/now-playing"
import { OBS_FONT } from "@/lib/obs-theme"
import { useCasinoTheme, type PlayToggleStyle, type StripIcon } from "@/components/obs/casino-themes"

/**
 * The two strips that frame the game capture.
 *
 * Presentational only, and shared by three routes: /obs/casino-top,
 * /obs/now-playing and /obs/casino-frame. They were inline in the first two
 * until the frame needed them as well, and three copies of a bar whose sizes
 * were solved off a screenshot is three chances to fix one and forget the rest.
 *
 * Which casino they look like comes from the theme in context (Stake when
 * there is none). The sizes below are shared by every casino; only tones,
 * logo, icons and the toggle change — see casino-themes.tsx.
 *
 * Every size is a fraction of `--h`, the strip's own height, which the caller
 * sets. So a strip is the same shape whatever height it is given.
 *
 * Nothing here was matched by eye. Sizes come from the casino's own bar, which
 * measures 32px tall in the reference capture, and each number is that
 * measurement over 32:
 *
 *   text        0.40h throughout. Solved twice from different strings — the
 *               title/provider pair and the Potential pair — landing on 0.405
 *               and 0.398 independently. The title is NOT bigger than the
 *               provider, only bolder.
 *   badge       0.50h tall, text 0.30h. The reference has 0.26h; the text was
 *               raised on request. The chip's height is what keeps it compact,
 *               so that stayed where it was measured.
 *   badge gap   0.41h to the title.
 *   divider     1px, 0.69h tall, between the title group and the figures.
 *
 * The typeface was solved for rather than guessed: six candidates, each asked
 * what size reproduces the measured pixel width of six known strings. Inter's
 * three bold strings agree on one size to within 0.3%; Geist disagrees by 4.7%.
 */

/** Kept as a name local to the strips; the stack itself lives in obs-theme. */
export const FONT_STACK = OBS_FONT

/** A fraction of the strip's height, as a CSS length. */
export const u = (fraction: number) => `calc(var(--h) * ${fraction})`

/* -------------------------------------------------------------- top strip */

/** Sizes of the top strip's icons, as fractions of its height. */
const ICON = {
  /** A bare glyph, as Stake draws them. */
  bare: 0.36,
  /** The button a glyph sits in, where the casino draws one. */
  chip: 0.64,
  /** The glyph inside that button. */
  inChip: 0.32,
} as const

function Icon({ icon }: { icon: StripIcon }) {
  const theme = useCasinoTheme()
  const chip = theme.iconChip
  const glyph = (size: number) =>
    icon.render({ width: u(size), height: u(size), display: "block", flexShrink: 0, color: theme.iconColor })

  if (!chip) return <>{glyph(ICON.bare)}</>

  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: u(ICON.chip),
        height: u(ICON.chip),
        backgroundColor: chip.background,
        borderRadius: chip.radius === "circle" ? "50%" : u(ICON.chip * chip.radius),
      }}
    >
      {glyph(ICON.inChip)}
    </span>
  )
}

/** Logo left, icons right. No data, no subscriptions — it is framing. */
export function CasinoTopStrip({ style }: { style?: CSSProperties }) {
  const theme = useCasinoTheme()

  return (
    <div
      className="absolute flex items-center overflow-hidden"
      style={{
        height: "var(--h)",
        backgroundColor: theme.colors.topBackground,
        padding: `0 ${u(0.34)}`,
        ...style,
      }}
    >
      {/* White-on-transparent PNGs, so each needs a height and nothing else;
          object-contain keeps it honest whatever the aspect ratio. */}
      <img
        src={theme.logo.src}
        alt={theme.name}
        className="shrink-0 object-contain"
        style={{ height: u(theme.logo.height) }}
      />

      <span
        className="ml-auto flex shrink-0 items-center"
        // Bare glyphs need air between them; buttons carry their own.
        style={{ gap: u(theme.iconChip ? 0.16 : 0.46) }}
      >
        {theme.icons.map((icon) => (
          <Icon key={icon.name} icon={icon} />
        ))}
      </span>
    </div>
  )
}

/* ----------------------------------------------------------- bottom strip */

/** A muted label with a bold figure after it — "Potential 25,000x". */
function Stat({ label, value, gap }: { label: string; value: string; gap?: number }) {
  const { colors } = useCasinoTheme()

  return (
    <span
      className="flex shrink-0 items-baseline whitespace-nowrap"
      style={{ gap: u(0.22), marginLeft: gap ? u(gap) : undefined }}
    >
      <span style={{ color: colors.muted, fontSize: u(0.4) }}>{label}</span>
      <span className="font-bold tabular-nums" style={{ color: colors.name, fontSize: u(0.4) }}>
        {value}
      </span>
    </span>
  )
}

/**
 * The Fun/Real control at the right-hand end of the bar.
 *
 * Stake's segmented version, sampled off the reference crop where the group
 * measures 40px tall:
 *
 *   group       a sunken well darker than the bar itself
 *   active      filled, white label — Real Play, since that is what a stream
 *               is doing
 *   padding     0.10 of the group's height, all round; the buttons are 0.80
 *   radius      0.15 of the group, 0.10 on the button inside it
 *   label       0.29h, semibold. The reference has 0.35 of the group, which
 *               works out at 10px here and reads as undersized beside the
 *               12px badge — the group is 29px tall against the crop's 40.
 *
 * The switch version (Gamdom, Roobet, CSGO500) uses the same label size, so
 * the two kinds sit at the same weight in the bar.
 *
 * Static, and deliberately outside the part of the bar that fades: these do
 * not change with the game, and blinking them on every slot switch would say
 * they did.
 */
function PlayToggle() {
  const { toggle } = useCasinoTheme()

  if (toggle.kind === "switch") return <PlaySwitch toggle={toggle} />

  /** Group height as a fraction of the strip; every size below is off this. */
  const box = 0.72

  const label = (text: string, on: boolean) => (
    <span
      key={text}
      className="flex items-center whitespace-nowrap"
      style={{
        height: u(box * 0.8),
        padding: `0 ${u(box * 0.3)}`,
        borderRadius: u(box * 0.1),
        backgroundColor: on ? toggle.fill : "transparent",
        color: on ? toggle.activeLabel : toggle.idleLabel,
        fontSize: u(0.29),
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  )

  return (
    <span
      className="ml-auto flex shrink-0 items-center"
      style={{
        height: u(box),
        padding: u(box * 0.1),
        gap: u(box * 0.1),
        borderRadius: u(box * 0.15),
        backgroundColor: toggle.well,
      }}
    >
      {toggle.labels.map((text, index) => label(text, index === toggle.active))}
    </span>
  )
}

type SwitchToggle = Extract<PlayToggleStyle, { kind: "switch" }>

/** A pill switch with a label either side — "Demo ( o) Real mode". */
function PlaySwitch({ toggle }: { toggle: SwitchToggle }) {
  /** Track height as a fraction of the strip; the rest is off this. */
  const track = 0.46
  const inset = track * 0.12
  const knob = track - inset * 2

  const label = (part: SwitchToggle["before"]) =>
    part && (
      <span className="whitespace-nowrap" style={{ color: part.color, fontWeight: part.weight, fontSize: u(0.29) }}>
        {part.text}
      </span>
    )

  return (
    <span className="ml-auto flex shrink-0 items-center" style={{ gap: u(0.22) }}>
      {label(toggle.before)}
      <span
        aria-hidden
        className="relative shrink-0"
        style={{
          width: u(track * 1.8),
          height: u(track),
          borderRadius: u(track / 2),
          backgroundColor: toggle.track,
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            top: u(inset),
            left: toggle.on ? `calc(100% - ${u(inset + knob)})` : u(inset),
            width: u(knob),
            height: u(knob),
            backgroundColor: toggle.knob,
          }}
        />
      </span>
      {label(toggle.after)}
    </span>
  )
}

/** The hairline between the title group and the figures. */
function Divider() {
  const { colors } = useCasinoTheme()

  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{
        width: 1,
        height: u(0.69),
        backgroundColor: colors.divider,
        marginLeft: u(0.44),
        marginRight: u(0.44),
      }}
    />
  )
}

/**
 * Backstop for the fade-out, in ms.
 *
 * The swap is normally driven by the transition actually ending, so there is
 * no waiting around after the text has gone. This only covers the cases where
 * no transitionend ever arrives: reduced motion turns the transition off, and
 * a hidden document stops it running at all. A little longer than the CSS
 * duration so it does not beat a transition that is merely late.
 */
const OBS_FADE_BACKSTOP_MS = 320

/**
 * The game on screen, whether its text is faded in, and the handler that
 * swaps it once the old text has gone.
 */
function useFadedRow(row: NowPlayingRow) {
  const key = `${row.slot_name}|${row.updated_at}`
  const [shown, setShown] = useState<NowPlayingRow | null>(null)
  const shownKey = shown && `${shown.slot_name}|${shown.updated_at}`

  // Read inside the swap rather than captured, so a game that changes twice
  // during one fade lands on the newest one and not the one in the middle.
  const latest = useRef(row)
  latest.current = row

  const commit = () => setShown(latest.current)

  useEffect(() => {
    if (shownKey === key) return

    // First game: adopt it now. It still fades in, because the first paint
    // happened with nothing shown and therefore at opacity 0.
    if (shown === null) {
      commit()
      return
    }

    const backstop = setTimeout(commit, OBS_FADE_BACKSTOP_MS)
    return () => clearTimeout(backstop)
  }, [key, shown, shownKey])

  return {
    shown: shown ?? row,
    visible: shownKey === key,
    // Swap on the frame the fade-out finishes, so the fade-in starts straight
    // away. A fixed timer instead left the bar sitting empty for the gap
    // between "no longer visible" and "timer due".
    onFadedOut: (event: TransitionEvent) => {
      if (event.propertyName === "opacity" && shownKey !== key) commit()
    },
  }
}

export function NowPlayingStrip({
  row,
  showArt,
  style,
}: {
  row: NowPlayingRow
  showArt?: boolean
  style?: CSSProperties
}) {
  // Out on the old game, in on the new. Not a crossfade: one set of text,
  // faded to nothing and back, so there is never a moment with two games
  // written over each other.
  //
  // The bar itself does not fade. Only its contents do — badge, name,
  // provider, Potential, Best Win. Fading the whole element took the
  // background with it, and a bar that vanishes and returns around a change of
  // text reads as the overlay dropping out, not as the game changing.
  //
  // This is also why the element is no longer keyed on the game. A key made
  // React throw the old bar away the instant the game changed, which is a cut,
  // not a fade — only the arrival was ever animated.
  const { shown, visible, onFadedOut } = useFadedRow(row)
  const { colors } = useCasinoTheme()

  const bestWin = formatMoney(shown.best_win)
  const art = showArt && shown.image_url

  return (
    <div
      className="obs-now-playing absolute flex items-center overflow-hidden"
      style={{
        height: "var(--h)",
        backgroundColor: colors.background,
        fontFamily: FONT_STACK,
        padding: `0 ${u(0.34)}`,
        // No shared gap. Every space in the reference is a different width, so
        // each one is set on the element it belongs to.
        gap: 0,
        ...style,
      }}
    >
      <div
        className="obs-now-playing-content flex min-w-0 flex-1 items-center"
        style={{ opacity: visible ? 1 : 0 }}
        onTransitionEnd={onFadedOut}
      >
        {art && (
          <img
            src={shown.image_url as string}
            alt=""
            className="shrink-0 object-cover"
            style={{ height: u(0.66), aspectRatio: "1 / 1", borderRadius: u(0.11) }}
          />
        )}

        {shown.badge && (
          <span
            className="flex shrink-0 items-center whitespace-nowrap"
            style={{
              backgroundImage: BADGE_GRADIENT,
              color: BADGE_TEXT,
              height: u(0.5),
              padding: `0 ${u(0.25)}`,
              borderRadius: u(0.15),
              // The chip keeps its 0.5h height — it was too tall once already.
              // Only the text grew, from 0.26h to 0.30h, so it fills a little
              // more of the chip rather than making the chip bigger.
              fontSize: u(0.3),
              // A step past the 700 the rest of the bar's bold text uses.
              // Inter is loaded as a variable font, so 800 is a real weight
              // here and not the browser thickening 700 by hand.
              fontWeight: 800,
              marginRight: u(0.41),
            }}
          >
            {shown.badge}
          </span>
        )}

        {/* The one thing allowed to shrink. Everything else is a fixed chip; if
            the source is narrower than the strip wants, a clipped title reads as
            a long name and a clipped figure reads as a wrong number. */}
        <span
          className="min-w-0 flex-shrink overflow-hidden text-ellipsis whitespace-nowrap font-bold"
          style={{ color: colors.name, fontSize: u(0.4), letterSpacing: "-0.005em" }}
        >
          {shown.slot_name}
        </span>

        {shown.provider && (
          <span
            className="shrink-0 whitespace-nowrap"
            style={{ color: colors.muted, fontSize: u(0.4), marginLeft: u(0.18) }}
          >
            {shown.provider}
          </span>
        )}

        {(shown.max_win || bestWin) && <Divider />}

        {shown.max_win && <Stat label="Potential" value={shown.max_win} />}
        {bestWin && <Stat label="Best Win" value={bestWin} gap={shown.max_win ? 0.44 : 0} />}
      </div>

      {/* Outside the fading half on purpose — see PlayToggle. */}
      <PlayToggle />
    </div>
  )
}

/* ------------------------------------------------------------------- data */

export const PREVIEW_ROW: NowPlayingRow = {
  id: 1,
  slot_name: "Loan Shark",
  provider: "Paperclip Gaming",
  image_url: null,
  max_win: "25,000x",
  badge: "Only on Stake",
  best_win: 31665,
  source: "admin",
  updated_at: new Date().toISOString(),
}

/** Subscribes to the single now_playing row, with a poller as a safety net. */
export function useNowPlaying(enabled: boolean) {
  const [row, setRow] = useState<NowPlayingRow | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!enabled) return
    const supabase = supabaseRef.current

    const fetchRow = async () => {
      const { data, error } = await supabase.from("now_playing").select("*").eq("id", 1).maybeSingle()
      if (error) {
        console.error("[v0] Error fetching now_playing:", error)
        return
      }
      setRow((data ?? null) as NowPlayingRow | null)
    }

    fetchRow()

    const channel = supabase
      .channel("now_playing_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "now_playing" }, (payload) => {
        setRow(payload.new as NowPlayingRow)
      })
      .subscribe()

    // The button that sets this is pressed in another browser, so a missed
    // realtime beat would leave the wrong game on stream until the next one.
    const poll = setInterval(fetchRow, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [enabled])

  return row
}
