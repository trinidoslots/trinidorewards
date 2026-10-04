"use client"

import type React from "react"
import { ACCENTS } from "@/components/ui/panel"
import { money, moneyExact } from "@/lib/leaderboard-format"
import { countdownTo } from "@/lib/schedule-week"
import { huntProgress, type HuntSnapshot } from "@/lib/landing"
import type { LandingBoard, LandingRaffle } from "@/hooks/use-landing-data"
import { shortLeft } from "@/components/landing/parts"

/**
 * The pictures at the top of each landing card.
 *
 * designeng puts a screenshot of the thing at the top of every card. These are
 * the site's equivalent, drawn rather than captured: a small view of the page
 * the card opens, filled with its live state where there is one. A module with
 * nothing running gets a still of the same view, never invented numbers.
 *
 * Each one fills the 16:9 frame the card gives it (absolute inset-0).
 */

function Frame({ children, glow }: { children: React.ReactNode; glow?: string }) {
  return (
    <div className="lp-dots absolute inset-0 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0d10]">
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(70% 80% at 85% 0%, ${glow}24, transparent 70%)` }}
        />
      )}
      {children}
    </div>
  )
}

/** Small faint label inside a picture. */
function Caption({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="font-geist-mono text-[10.5px] font-medium uppercase tracking-[0.14em]" style={{ color: color ?? "rgb(255 255 255 / 0.35)" }}>
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- Bonus hunt */

/**
 * The hunt as its bonuses: one square per bonus, filled once it is opened,
 * beside the balance. The squares are what the hunt page is about — a list
 * being worked through — so they say "in progress" before any number does.
 */
export function HuntMedia({ hunt }: { hunt: HuntSnapshot | null }) {
  const accent = ACCENTS.amber
  const total = hunt ? Math.min(Math.max(hunt.totalBonuses, 1), 40) : 24
  const opened = hunt ? Math.min(hunt.openedBonuses, total) : 0
  const progress = hunt ? huntProgress(hunt) : null

  return (
    <Frame glow={accent}>
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Caption color={hunt ? accent : undefined}>{hunt ? "Hunt balance" : "Bonus hunt"}</Caption>
            <p className="mt-1.5 text-[clamp(22px,2.4vw,30px)] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">
              {hunt ? moneyExact(hunt.currentBalance) : "Next hunt"}
            </p>
            {progress && hunt && (
              <p className="mt-1.5 text-[12px] tabular-nums text-white/50">
                <span style={{ color: progress.ahead ? ACCENTS.green : ACCENTS.red }}>
                  {progress.ahead ? "+" : "−"}
                  {moneyExact(Math.abs(progress.profit))}
                </span>{" "}
                on {moneyExact(hunt.startingBalance)}
              </p>
            )}
          </div>
          {progress && (
            <div className="text-right">
              <p className="text-[22px] font-semibold leading-none tabular-nums text-white">{progress.percent}%</p>
              <Caption>opened</Caption>
            </div>
          )}
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(14px,1fr))] gap-[5px]">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className="lp-cell aspect-square rounded-[3px]"
              style={{
                backgroundColor: index < opened ? accent : "rgb(255 255 255 / 0.07)",
                boxShadow: index < opened ? `0 0 10px -2px ${accent}90` : undefined,
                animationDelay: `${index * 20}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------- Leaderboard */

/** The pool, and the top three standing on a podium of square blocks. */
export function BoardMedia({ board, now }: { board: LandingBoard | null; now: number }) {
  const accent = ACCENTS.blue
  const steps = [
    { place: 2, name: board?.top[1], height: "52%" },
    { place: 1, name: board?.top[0], height: "78%" },
    { place: 3, name: board?.top[2], height: "36%" },
  ]

  return (
    <Frame glow={accent}>
      <div className="absolute inset-0 flex flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Caption color={board ? accent : undefined}>Prize pool</Caption>
            <p className="mt-1.5 text-[clamp(22px,2.4vw,30px)] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">
              {board ? money(board.pool) : "Monthly"}
            </p>
          </div>
          {board && (
            <span className="font-geist-mono rounded-md bg-black/40 px-2 py-1 text-[10.5px] tabular-nums text-white/50">
              {shortLeft(countdownTo(board.endsAt, now), "Ended")}
            </span>
          )}
        </div>

        <div className="mt-auto grid h-[52%] grid-cols-3 items-end gap-1.5">
          {steps.map((step) => (
            <div key={step.place} className="flex h-full min-w-0 flex-col justify-end">
              <p className="mb-1.5 truncate text-center text-[11.5px] font-medium text-white/80">{step.name ?? "—"}</p>
              <div
                className="flex items-start justify-center rounded-t-md pt-1.5"
                style={{
                  height: step.height,
                  background:
                    step.place === 1
                      ? `linear-gradient(to bottom, ${accent}, ${accent}55)`
                      : "linear-gradient(to bottom, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0.04))",
                }}
              >
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: step.place === 1 ? "#0b0b0b" : "rgb(255 255 255 / 0.6)" }}>
                  {step.place}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ Raffle */

/** A ticket: the prize, a tear line with a notch at each end, the count. */
export function RaffleMedia({ raffle, now }: { raffle: LandingRaffle | null; now: number }) {
  const accent = ACCENTS.pink
  const left = raffle?.endsAt ? countdownTo(raffle.endsAt, now) : null

  return (
    <Frame glow={accent}>
      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div className="relative w-[82%] max-w-[300px] -rotate-3 overflow-hidden rounded-xl border border-white/10 bg-[#18181c] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]">
          <div className="h-1" style={{ backgroundColor: accent }} />
          <div className="px-4 pb-3 pt-3.5">
            <Caption color={accent}>{raffle ? "Raffle" : "Raffles"}</Caption>
            <p className="mt-1 line-clamp-1 text-[clamp(18px,2vw,24px)] font-semibold leading-tight tracking-[-0.02em] text-white">
              {raffle ? raffle.prize || raffle.title : "Draws every week"}
            </p>
          </div>
          <div className="relative">
            <div className="mx-3 border-t border-dashed border-white/15" />
            <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-[#0d0d10]" />
            <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-[#0d0d10]" />
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-[11.5px] tabular-nums text-white/50">
            <span>{raffle ? `${raffle.tickets.toLocaleString("en-US")} tickets` : "Free entry"}</span>
            <span>{raffle ? (left ? shortLeft(left, "Drawing") : "Drawing soon") : "Drawn live"}</span>
          </div>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------- Tournaments */

/** Eight names narrowing to one: the bracket itself, in square lines. */
export function TournamentMedia() {
  const accent = ACCENTS.purple
  // x of each round's column, y of each slot; drawn in a 320x180 box.
  const rounds = [
    { x: 24, ys: [22, 42, 66, 86, 104, 124, 148, 168] },
    { x: 116, ys: [32, 76, 114, 158] },
    { x: 208, ys: [54, 136] },
    { x: 288, ys: [95] },
  ]
  return (
    <Frame glow={accent}>
      <svg viewBox="0 0 320 190" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        {rounds.slice(0, -1).map((round, r) =>
          rounds[r + 1].ys.map((y, i) => {
            const a = round.ys[i * 2]
            const b = round.ys[i * 2 + 1]
            const mid = (round.x + 56 + rounds[r + 1].x) / 2
            const lit = r === 2 || (r === 1 && i === 0) || (r === 0 && i === 0)
            return (
              <path
                key={`${r}-${i}`}
                d={`M${round.x + 56} ${a} H${mid} V${b} H${round.x + 56} M${mid} ${y} H${rounds[r + 1].x}`}
                fill="none"
                stroke={lit ? accent : "rgb(255 255 255 / 0.16)"}
                strokeWidth="1.25"
              />
            )
          }),
        )}
        {rounds.map((round, r) =>
          round.ys.map((y, i) => {
            const lit = r === 3 || (r === 2 && i === 0) || (r === 1 && i === 0) || (r === 0 && i === 0)
            const width = r === 3 ? 26 : 56
            return (
              <rect
                key={`n-${r}-${i}`}
                x={round.x}
                y={y - 6}
                width={width}
                height="12"
                fill={r === 3 ? accent : lit ? `${accent}55` : "rgb(255 255 255 / 0.08)"}
              />
            )
          }),
        )}
      </svg>
    </Frame>
  )
}

/* -------------------------------------------------------------- Challenges */

/** The target, squared off: rings closing in on the multiplier to hit. */
export function ChallengeMedia() {
  const accent = ACCENTS.red
  return (
    <Frame glow={accent}>
      <div className="absolute inset-0 flex items-center justify-center">
        {[92, 70, 48].map((size, index) => (
          <span
            key={size}
            className="absolute aspect-square rounded-full border"
            style={{ height: `${size}%`, borderColor: index === 2 ? accent : `rgb(255 255 255 / ${0.08 + index * 0.05})` }}
          />
        ))}
        <span className="relative text-[clamp(22px,2.6vw,32px)] font-semibold tracking-[-0.03em] text-white">
          500<span style={{ color: accent }}>x</span>
        </span>
        <span className="absolute left-1/2 top-[4%] h-[14%] w-px -translate-x-1/2" style={{ backgroundColor: accent }} />
        <span className="absolute bottom-[4%] left-1/2 h-[14%] w-px -translate-x-1/2" style={{ backgroundColor: accent }} />
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------- Store */

/** Three of the store's own gift cards, fanned. */
export function StoreMedia() {
  // A cascade from the top left, each card lower and to the right of the one
  // before, so every card's value (bottom left) stays in view.
  const cards = [
    { src: "/store/gift-cards/gift-card-10.png", x: "-62%", y: "-34%" },
    { src: "/store/crypto-cards/crypto-card-25.png", x: "-50%", y: "-50%" },
    { src: "/store/gift-cards/gift-card-50.png", x: "-38%", y: "-66%" },
  ]
  return (
    <Frame glow={ACCENTS.pink}>
      <div className="absolute inset-0">
        {cards.map((card, index) => (
          <img
            key={card.src}
            src={card.src}
            alt=""
            loading="lazy"
            className="absolute w-[44%] rounded-lg shadow-[0_16px_36px_-10px_rgba(0,0,0,0.95)]"
            style={{
              left: `${30 + index * 20}%`,
              top: `${34 + index * 16}%`,
              transform: `translate(${card.x}, ${card.y})`,
            }}
          />
        ))}
      </div>
    </Frame>
  )
}

/* ---------------------------------------------------------- Advent calendar */

/** Twenty-four doors, the ones already past opened. */
export function AdventMedia({ now }: { now: number }) {
  const accent = ACCENTS.red
  const date = new Date(now)
  const opened = date.getMonth() === 11 ? Math.min(date.getDate(), 24) : 0
  return (
    <Frame glow={accent}>
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-3 gap-1.5 p-5">
        {Array.from({ length: 24 }, (_, index) => (
          <span
            key={index}
            className="flex items-end justify-start rounded-[4px] p-1 text-[10px] font-semibold tabular-nums"
            style={{
              backgroundColor: index < opened ? `${accent}cc` : "rgb(255 255 255 / 0.06)",
              color: index < opened ? "#0b0b0b" : "rgb(255 255 255 / 0.4)",
            }}
          >
            {index + 1}
          </span>
        ))}
      </div>
    </Frame>
  )
}
