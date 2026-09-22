"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { SceneBackground } from "@/components/obs/scene-background"
import { COLUMN_GRADIENT, OBS } from "@/lib/obs-theme"
import { ACCENTS } from "@/components/ui/panel"
import {
  countdownFrom,
  formatCountdown,
  STARTING_SOON_DEFAULTS,
  type StartingSoonRow,
} from "@/lib/starting-soon"

const SCENE = { width: 1920, height: 1080 }

/** Matches the combined scene's bar, so cutting between them does not jump. */
const TOP_BAR_HEIGHT = 50

/**
 * ?preview=1 shows a sample countdown without touching what is saved, so the
 * source can be positioned before there is anything to wait for.
 *
 * ?in=<seconds> moves that sample: ?in=0 or a negative value is how you see the
 * zero state, which is otherwise only visible by waiting for it.
 */
const PREVIEW_DEFAULT_SECONDS = 8 * 60 + 34

/** Seconds from ?in=, falling back when it is missing, blank or unreadable. */
function previewOffset(raw: string | null): number {
  if (raw === null || raw.trim() === "") return PREVIEW_DEFAULT_SECONDS
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : PREVIEW_DEFAULT_SECONDS
}

function previewRow(offsetSeconds: number): StartingSoonRow {
  return {
    id: 1,
    starts_at: new Date(Date.now() + offsetSeconds * 1000).toISOString(),
    headline: "Starting soon",
    subline: "Bonus hunt opening, leaderboard running all month",
    ended_text: "Any moment now",
    updated_at: new Date().toISOString(),
  }
}

/** Subscribes to the single starting_soon row, with a poller as a safety net. */
function useStartingSoon(enabled: boolean) {
  const [row, setRow] = useState<StartingSoonRow | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!enabled) return
    const supabase = supabaseRef.current

    const fetchRow = async () => {
      const { data, error } = await supabase.from("starting_soon").select("*").eq("id", 1).maybeSingle()
      if (error) {
        console.error("[v0] Error fetching starting_soon:", error)
        return
      }
      if (data) setRow(data as StartingSoonRow)
    }

    fetchRow()

    const channel = supabase
      .channel("starting_soon_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "starting_soon" }, (payload) => {
        setRow(payload.new as StartingSoonRow)
      })
      .subscribe()

    // Realtime can miss a beat, and this screen is the one nobody is watching
    // the admin panel for — it is on stream while you are away from the desk.
    const poll = setInterval(fetchRow, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [enabled])

  return row
}

/**
 * A clock that ticks on the second boundary rather than every 1000ms.
 *
 * setInterval(…, 1000) drifts: each tick is scheduled a second after the last
 * one *ran*, so the display slowly slides away from the real second and
 * eventually skips a number. Re-aiming at the next boundary each time keeps it
 * on the second for the whole wait, which on a countdown that may be up an hour
 * is the difference between right and visibly wrong.
 */
function useSecondTick(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const current = Date.now()
      setNow(current)
      timer = setTimeout(schedule, 1000 - (current % 1000))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])

  return now
}

function StartingSoon() {
  const params = useSearchParams()
  const isPreview = params.get("preview") === "1"

  const live = useStartingSoon(!isPreview)

  // Built once and kept, not rebuilt each render: a target computed from
  // Date.now() on every tick would sit at the same number forever.
  //
  // Read through a guard, not Number(...) — Number(null) is 0, not NaN, so a
  // missing ?in= read as a zero offset and the preview opened on the ended
  // state instead of on a countdown.
  const [sample] = useState(() => previewRow(previewOffset(params.get("in"))))

  const row = isPreview ? sample : live
  const now = useSecondTick()

  const countdown = countdownFrom(row?.starts_at, now)
  const clock = formatCountdown(countdown)

  const headline = row?.headline?.trim() || STARTING_SOON_DEFAULTS.headline
  const subline = row?.subline?.trim() || null
  const endedText = row?.ended_text?.trim() || STARTING_SOON_DEFAULTS.ended_text

  return (
    <div
      className="relative overflow-hidden bg-transparent"
      style={{ width: SCENE.width, height: SCENE.height, fontFamily: "Geist, sans-serif" }}
    >
      <SceneBackground />

      {/* The same bar tone as the combined scene, so the two cut together
          cleanly. Not the live /obs/top-bar source: that one carries balances
          and timers, and none of it means anything before the stream starts. */}
      <div
        className="absolute left-0 top-0"
        style={{ width: SCENE.width, height: TOP_BAR_HEIGHT, backgroundImage: COLUMN_GRADIENT }}
      />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ paddingTop: TOP_BAR_HEIGHT }}
      >
        <div className="flex items-center gap-3" style={{ marginBottom: 28 }}>
          <span
            className="block h-2 w-2 rounded-full landing-pulse"
            style={{ backgroundColor: ACCENTS.blue }}
          />
          <span
            className="font-mono uppercase"
            style={{ color: OBS.muted, fontSize: 20, letterSpacing: "0.34em" }}
          >
            Trinido Rewards
          </span>
        </div>

        <h1
          className="text-center font-extrabold leading-[0.95]"
          style={{ color: OBS.value, fontSize: 108, letterSpacing: "-0.03em" }}
        >
          {headline}
        </h1>

        {/* Fixed height whether or not there is a clock, so the headline does
            not jump up the screen the moment the countdown runs out. */}
        <div className="flex items-center justify-center" style={{ height: 210, marginTop: 24 }}>
          {clock ? (
            <div
              // Tabular figures: without them every digit is a different width
              // and the whole clock shuffles sideways once a second.
              className="font-extrabold tabular-nums"
              style={{
                color: "#FFFFFF",
                fontSize: 176,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                textShadow: "0 18px 60px rgba(0, 0, 0, 0.55)",
              }}
            >
              {clock}
            </div>
          ) : (
            <div
              className="font-bold"
              style={{ color: ACCENTS.blue, fontSize: 64, letterSpacing: "-0.01em" }}
            >
              {countdown.kind === "elapsed" ? endedText : ""}
            </div>
          )}
        </div>

        {subline && (
          <p className="max-w-[1100px] text-center" style={{ color: OBS.muted, fontSize: 30, marginTop: 4 }}>
            {subline}
          </p>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 flex w-full items-center justify-between"
        style={{ padding: "0 56px", height: 84, color: OBS.muted, fontSize: 18 }}
      >
        <span className="font-mono uppercase" style={{ letterSpacing: "0.22em" }}>
          trinidorewards.com
        </span>
        <span className="font-mono uppercase" style={{ letterSpacing: "0.22em" }}>
          18+ · begambleaware.org
        </span>
      </div>
    </div>
  )
}

export default function StartingSoonPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div style={{ width: SCENE.width, height: SCENE.height }} />}>
      <StartingSoon />
    </Suspense>
  )
}
