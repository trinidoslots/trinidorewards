"use client"

import Link from "next/link"
import type React from "react"
import { ArrowUpRight } from "lucide-react"
import { ACCENTS, type Accent } from "@/components/ui/panel"
import { KICK_GREEN } from "@/components/landing/parts"

/**
 * The section under the hero: every part of the site as a bento grid of
 * pictures (shadcn, HeroUI, Hyper). The first card is wide and the wide ones
 * alternate sides; what is running comes first and says so in its corner.
 */

export type ModuleCardData = {
  href: string
  title: string
  copy: string
  accent: Accent
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  media: React.ReactNode
  /** Something running right now: the short state shown in the card's corner. */
  live?: string
}

export function Bento({ cards, liveCount }: { cards: ModuleCardData[]; liveCount: number }) {
  if (cards.length === 0) return null
  const wide = wideCards(cards.length)
  return (
    <section id="now" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-24 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div>
          <Label index="02">Rewards</Label>
          <h2 className="mt-5 text-[clamp(30px,4vw,48px)] font-semibold leading-[1.04] tracking-[-0.035em] text-white">
            {numberWord(cards.length)} ways to win.
            <br />
            <span className="text-white/40">Every one of them free.</span>
          </h2>
        </div>
        {liveCount > 0 && (
          <span className="font-geist-mono flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full opacity-70" style={{ backgroundColor: KICK_GREEN }} />
              <span className="relative h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KICK_GREEN }} />
            </span>
            {liveCount} running now
          </span>
        )}
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <BentoCard key={card.href} card={card} index={index} wide={wide.has(index)} />
        ))}
      </div>
    </section>
  )
}

/** "[ 01 ] BONUS HUNT" — the small monospaced label over a section or a card. */
function Label({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <span className="font-geist-mono inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
      <span className="text-white/25">[ {index} ]</span>
      {children}
    </span>
  )
}

function BentoCard({ card, index, wide }: { card: ModuleCardData; index: number; wide: boolean }) {
  const color = ACCENTS[card.accent]
  const Icon = card.icon
  return (
    <Link
      href={card.href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-2 transition duration-300 hover:border-white/[0.18] ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      {/* The accent, only as light from behind the picture on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ backgroundColor: color }}
      />
      {/* The wide card's picture sets the row's height; a narrow one beside
          it lets its picture take up the difference instead of leaving a gap
          under its text. */}
      <div
        className={`relative overflow-hidden ${
          wide ? "aspect-[16/10] md:aspect-[16/7]" : "aspect-[16/10] lg:aspect-auto lg:min-h-[220px] lg:flex-1"
        }`}
      >
        <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.025]">
          {card.media}
        </div>
      </div>
      <div className={`relative flex flex-col px-3 pb-3 pt-4 ${wide ? "flex-1" : ""}`}>
        <div className="flex items-center gap-2.5">
          <Label index={String(index + 1).padStart(2, "0")}>{card.title}</Label>
          {card.live && (
            <span className="font-geist-mono ml-auto flex items-center gap-1.5 text-[10.5px] tabular-nums text-white/45">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {card.live}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <p className="max-w-md text-[15px] leading-[23px] text-white/55">
            <span className="font-medium text-white">
              <Icon className="mr-1.5 inline h-4 w-4 -translate-y-px" style={{ color }} />
              {card.title}.
            </span>{" "}
            {card.copy}
          </p>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition group-hover:border-white/30 group-hover:bg-white group-hover:text-black">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * Which cards span two columns, so every row of three is full.
 *
 * Rows are either a wide card and a narrow one, alternating sides — the
 * zigzag bento — or three narrow ones at the end. The number of wide cards is
 * whatever makes the slots come out to a multiple of three; if that would need
 * more wide cards than there are narrow ones to pair them with, none are wide.
 */
function wideCards(count: number): Set<number> {
  if (count === 1) return new Set([0])
  const wide = ((3 - ((count + 1) % 3)) % 3) + 1
  if (wide * 2 > count) return new Set()
  const result = new Set<number>()
  for (let row = 0; row < wide; row++) result.add(row * 2 + (row % 2 === 0 ? 0 : 1))
  return result
}

function numberWord(count: number): string {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
  return words[count] ?? String(count)
}
