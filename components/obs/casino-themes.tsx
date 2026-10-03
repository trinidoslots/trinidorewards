"use client"

import type { CSSProperties, ReactNode } from "react"
import { createContext, useContext } from "react"
import {
  Bell,
  CircleUser,
  Crown,
  Gift,
  Mail,
  MessageCircle,
  MessageSquare,
  ReceiptText,
  Search,
  User,
} from "lucide-react"
import { CASINO_NAMES, isCasinoId, type CasinoId } from "@/lib/casinos"

/**
 * Each casino the frame can dress up as.
 *
 * The layout is the same for all of them — logo and icons in the top strip,
 * the game and the play toggle in the bottom one, rails between — and only
 * what is in this file changes: the tones, the logo, the icon set and the
 * shape of the Fun/Real control.
 *
 * Stake's numbers are the ones the strips were first solved against; see the
 * notes in casino-strips.tsx. The others were sampled off screenshots of each
 * casino's game page: header tone, the bar under the game, the muted text in
 * that bar, and the toggle as the casino draws it. The logos in
 * public/casinos/ are cut out of the same screenshots. Dropping an official
 * transparent PNG in at the same path replaces one without touching code.
 */

/** An icon in the top strip, drawn at the size and colour it is given. */
export type StripIcon = {
  name: string
  render: (style: CSSProperties) => ReactNode
}

/**
 * The Fun/Real control at the right-hand end of the bottom strip.
 *
 * segmented: two labels in a sunken well, the active one filled (Stake,
 *            Shuffle, Gamba).
 * switch:    a pill switch with a label either side (Gamdom, Roobet,
 *            CSGO500). `on` is where the knob sits.
 */
export type PlayToggleStyle =
  | {
      kind: "segmented"
      /** Left to right; `active` is the index of the filled one. */
      labels: [string, string]
      active: 0 | 1
      well: string
      fill: string
      activeLabel: string
      idleLabel: string
    }
  | {
      kind: "switch"
      before?: { text: string; color: string; weight: number }
      after?: { text: string; color: string; weight: number }
      on: boolean
      track: string
      knob: string
    }

export type CasinoTheme = {
  id: CasinoId
  name: string
  logo: {
    src: string
    /** Drawn height as a fraction of the top strip. */
    height: number
  }
  /** The tones the strips are built from; same roles as Stake's STRIP. */
  colors: {
    background: string
    topBackground: string
    name: string
    muted: string
    divider: string
    outline: string
  }
  icons: StripIcon[]
  iconColor: string
  /**
   * The button each icon sits in, when the casino draws one. `radius` is a
   * fraction of the button's size, or "circle".
   */
  iconChip?: { background: string; radius: number | "circle" }
  toggle: PlayToggleStyle
}

/* ------------------------------------------------------------------ icons */

/**
 * Stake's icons, copied path-for-path out of its markup rather than redrawn —
 * a hand-traced bell next to a real one is the kind of near-miss that reads as
 * a mistake. Each keeps its original 20x20 viewBox.
 */
function stakeIcon(name: string, path: string): StripIcon {
  return {
    name,
    render: (style) => (
      <svg viewBox="0 0 20 20" fill="none" role="img" aria-label={name} style={style}>
        <path fill="currentColor" d={path} />
      </svg>
    ),
  }
}

type LucideIcon = typeof Search

/** The other casinos: the nearest Lucide glyph to what each header shows. */
function lucide(name: string, Glyph: LucideIcon): StripIcon {
  return {
    name,
    render: (style) => <Glyph aria-label={name} strokeWidth={2.25} style={style} />,
  }
}

/* ------------------------------------------------------------------ casinos */

const STAKE: CasinoTheme = {
  id: "stake",
  name: CASINO_NAMES.stake,
  // A 2:1 PNG with its own padding, hence a height that looks large next to
  // the tightly cropped logos below.
  logo: { src: "/stake-logo-white.png", height: 0.48 },
  colors: {
    background: "#203744",
    /**
     * The casino's own header, sampled off the reference capture. Not
     * #101E28, which is the inset panel the wallet button sits in.
     */
    topBackground: "#172B39",
    name: "#FFFFFF",
    /**
     * The provider and both stat labels — measured at #94ACB8 and #9EB4C0,
     * which is one colour plus antialiasing noise.
     */
    muted: "#94ACB8",
    divider: "#28404C",
    /**
     * The bar's own tone with the lightness raised and nothing else touched:
     * hsl(202, 36%, 20%) to hsl(202, 36%, 30%). It reads as the frame's edge
     * catching the light rather than as a second colour laid on top.
     */
    outline: "#315468",
  },
  icons: [
    stakeIcon(
      "Search",
      "m18.93 17.74-4.02-4.01a7.91 7.91 0 1 0-1.18 1.18l4.01 4q.26.25.6.25t.59-.24a.83.83 0 0 0 0-1.18M2.5 8.75a6.25 6.25 0 1 1 12.5 0 6.25 6.25 0 0 1-12.5 0",
    ),
    stakeIcon(
      "Account",
      "M10 9.17a4.17 4.17 0 1 0 0-8.34 4.17 4.17 0 0 0 0 8.34m-2.5 1.66h5a6.66 6.66 0 0 1 6.67 6.67c0 .92-.75 1.67-1.67 1.67h-15c-.92 0-1.67-.75-1.67-1.67a6.66 6.66 0 0 1 6.67-6.67",
    ),
    stakeIcon(
      "Notifications",
      "M16.3 11.85V7.3a6.3 6.3 0 1 0-12.6 0v4.55a2.25 2.25 0 0 0 .45 4.45h11.7a2.25 2.25 0 0 0 .45-4.45M10 19a3.6 3.6 0 0 0 3.1-1.8H6.9A3.6 3.6 0 0 0 10 19",
    ),
    stakeIcon(
      "Sidebar",
      "M17.5.83h-15C1.58.83.83 1.58.83 2.5v15c0 .92.75 1.67 1.67 1.67h15c.92 0 1.67-.75 1.67-1.67v-15c0-.92-.75-1.67-1.67-1.67m-6.67 15.65c0 .56-.46 1.02-1.01 1.02h-6.3c-.56 0-1.02-.46-1.02-1.02V3.52c0-.56.46-1.02 1.02-1.02h6.3c.55 0 1.01.46 1.01 1.02z",
    ),
  ],
  // White, not the bar's muted blue-grey. These are the only icons in the
  // frame, so nothing is being de-emphasised against anything.
  iconColor: "#FFFFFF",
  /**
   * Sampled off the reference crop: a sunken well darker than the bar, Real
   * Play filled since that is what a stream is doing.
   */
  toggle: {
    kind: "segmented",
    labels: ["Fun Play", "Real Play"],
    active: 1,
    well: "#172530",
    fill: "#3E586C",
    activeLabel: "#FFFFFF",
    idleLabel: "#A1BFD6",
  },
}

const GAMBA: CasinoTheme = {
  id: "gamba",
  name: CASINO_NAMES.gamba,
  logo: { src: "/casinos/gamba-logo.png", height: 0.6 },
  colors: {
    background: "#1C202C",
    topBackground: "#242937",
    name: "#FFFFFF",
    muted: "#7F8DA0",
    divider: "#2C3242",
    outline: "#3A4152",
  },
  icons: [lucide("Search", Search), lucide("Messages", Mail), lucide("Chat", MessageSquare)],
  iconColor: "#FFFFFF",
  iconChip: { background: "#33394A", radius: 0.12 },
  toggle: {
    kind: "segmented",
    labels: ["Fun Play", "Real Play"],
    active: 1,
    well: "#161A23",
    fill: "#282D3B",
    activeLabel: "#FFFFFF",
    idleLabel: "#4C5262",
  },
}

const GAMDOM: CasinoTheme = {
  id: "gamdom",
  name: CASINO_NAMES.gamdom,
  logo: { src: "/casinos/gamdom-logo.png", height: 0.5 },
  colors: {
    // The header and the bar under the game are one tone on Gamdom.
    background: "#070D12",
    topBackground: "#070D12",
    name: "#FFFFFF",
    muted: "#8493A7",
    divider: "#1A242C",
    outline: "#22303A",
  },
  icons: [lucide("Search", Search), lucide("Rewards", Gift), lucide("Notifications", Bell), lucide("Account", User)],
  iconColor: "#888F9A",
  iconChip: { background: "#121A21", radius: 0.16 },
  toggle: {
    kind: "switch",
    before: { text: "Demo", color: "#8493A7", weight: 500 },
    after: { text: "Real mode", color: "#FFFFFF", weight: 700 },
    on: true,
    track: "#01FF87",
    knob: "#FFFFFF",
  },
}

const ROOBET: CasinoTheme = {
  id: "roobet",
  name: CASINO_NAMES.roobet,
  logo: { src: "/casinos/roobet-logo.png", height: 0.58 },
  colors: {
    background: "#0A0B1D",
    topBackground: "#1A1939",
    name: "#FFFFFF",
    muted: "#9E9BD0",
    divider: "#232046",
    outline: "#34306A",
  },
  icons: [lucide("Search", Search), lucide("Notifications", Bell), lucide("Chat", MessageSquare)],
  iconColor: "#FFFFFF",
  iconChip: { background: "#2D2853", radius: 0.22 },
  // The reference shows Fun Mode selected; this is the same switch flipped,
  // which on Roobet fills the track and swaps which label is bold.
  toggle: {
    kind: "switch",
    before: { text: "Fun Mode", color: "#A38ADB", weight: 500 },
    after: { text: "Real Mode", color: "#FFFFFF", weight: 700 },
    on: true,
    track: "#9E8CD8",
    knob: "#FFFFFF",
  },
}

const SHUFFLE: CasinoTheme = {
  id: "shuffle",
  name: CASINO_NAMES.shuffle,
  logo: { src: "/casinos/shuffle-logo.png", height: 0.46 },
  colors: {
    background: "#121418",
    topBackground: "#080808",
    name: "#FFFFFF",
    muted: "#A4AAB8",
    divider: "#2A2D35",
    outline: "#2E323B",
  },
  icons: [
    lucide("Bets", ReceiptText),
    lucide("VIP", Crown),
    lucide("Chat", MessageCircle),
    lucide("Account", CircleUser),
  ],
  iconColor: "#F2F6FE",
  // Shuffle's header buttons are circles.
  iconChip: { background: "#2A2D37", radius: "circle" },
  toggle: {
    kind: "segmented",
    labels: ["Real", "Fun"],
    active: 0,
    well: "#202329",
    fill: "#2A2D35",
    activeLabel: "#FFFFFF",
    idleLabel: "#C0C8DC",
  },
}

const CSGO500: CasinoTheme = {
  id: "csgo500",
  name: CASINO_NAMES.csgo500,
  logo: { src: "/casinos/csgo500-logo.png", height: 0.62 },
  colors: {
    background: "#292731",
    topBackground: "#272231",
    name: "#FFFFFF",
    muted: "#938FA7",
    divider: "#3A3646",
    outline: "#433E54",
  },
  icons: [lucide("Search", Search), lucide("Rewards", Gift), lucide("Account", User)],
  iconColor: "#F5F1FB",
  iconChip: { background: "#2A2635", radius: 0.1 },
  // One label only on CSGO500: a "Fun Play" switch that is off while playing
  // for real, which is exactly how the reference shows it.
  toggle: {
    kind: "switch",
    after: { text: "Fun Play", color: "#938FA7", weight: 600 },
    on: false,
    track: "#1D1C21",
    knob: "#8F8CA1",
  },
}

export const CASINOS: Record<CasinoId, CasinoTheme> = {
  stake: STAKE,
  gamba: GAMBA,
  gamdom: GAMDOM,
  roobet: ROOBET,
  shuffle: SHUFFLE,
  csgo500: CSGO500,
}

/** Stake when the id is missing or unknown, which is what every link did before. */
export function casinoTheme(id: string | null | undefined): CasinoTheme {
  return isCasinoId(id) ? CASINOS[id] : STAKE
}

const CasinoThemeContext = createContext<CasinoTheme>(STAKE)

export function CasinoThemeProvider({ theme, children }: { theme: CasinoTheme; children: ReactNode }) {
  return <CasinoThemeContext.Provider value={theme}>{children}</CasinoThemeContext.Provider>
}

export function useCasinoTheme() {
  return useContext(CasinoThemeContext)
}
