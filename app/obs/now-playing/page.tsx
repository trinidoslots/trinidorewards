"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { COLUMN_GRADIENT, OBS } from "@/lib/obs-theme"
import { ACCENTS } from "@/components/ui/panel"
import { isPlaying, type NowPlayingRow } from "@/lib/now-playing"

/**
 * The slot currently being played, as a bar for OBS.
 *
 * Sized to fill whatever the browser source is set to — make it 1920×72 and it
 * spans the scene, make it 900×64 and it sits in a corner. Nothing here is a
 * fixed pixel width, so the source properties are the only place a size lives.
 *
 * When nothing is playing it renders nothing at all, so the source can be left
 * on the scene permanently instead of being toggled by hand every time the
 * streamer leaves a game.
 */

const PREVIEW_ROW: NowPlayingRow = {
  id: 1,
  slot_name: "Thunder vs Underworld 250",
  provider: "Pragmatic Play",
  image_url: null,
  max_win: "25,000x",
  badge: "Only on Stake",
  source: "admin",
  updated_at: new Date().toISOString(),
}

/** Subscribes to the single now_playing row, with a poller as a safety net. */
function useNowPlaying(enabled: boolean) {
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

    // The button that sets this is pressed on another machine's browser, so a
    // missed realtime beat would leave the wrong game on stream until the next
    // one. Five seconds is the ceiling on being wrong.
    const poll = setInterval(fetchRow, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [enabled])

  return row
}

function NowPlaying() {
  const params = useSearchParams()
  const isPreview = params.get("preview") === "1"

  const live = useNowPlaying(!isPreview)
  const row = isPreview ? PREVIEW_ROW : live

  // Nothing playing: nothing drawn. Not an empty bar, not a placeholder.
  if (!isPlaying(row)) return null

  const art = params.get("art") !== "0" && row.image_url

  return (
    <div className="h-screen w-full bg-transparent">
      <div
        // Keyed on the game so the bar fades in again on every change rather
        // than swapping text inside a bar that never moves.
        key={`${row.slot_name}|${row.updated_at}`}
        className="obs-now-playing flex h-full w-full items-center gap-4 overflow-hidden px-6"
        style={{ backgroundImage: COLUMN_GRADIENT, fontFamily: "Geist, sans-serif" }}
      >
        {art && (
          <img
            src={row.image_url as string}
            alt=""
            className="h-[68%] shrink-0 rounded-md object-cover"
            style={{ aspectRatio: "1 / 1" }}
          />
        )}

        {row.badge && (
          <span
            className="shrink-0 rounded-full px-3 py-1 text-[15px] font-semibold"
            style={{ backgroundColor: `${ACCENTS.green}22`, color: ACCENTS.green }}
          >
            {row.badge}
          </span>
        )}

        <span
          className="shrink-0 truncate text-[26px] font-bold leading-none"
          style={{ color: OBS.value, letterSpacing: "-0.01em" }}
        >
          {row.slot_name}
        </span>

        {row.provider && (
          <span className="shrink-0 truncate text-[20px] leading-none" style={{ color: OBS.muted }}>
            {row.provider}
          </span>
        )}

        {row.max_win && (
          <span className="ml-auto flex shrink-0 items-baseline gap-2">
            <span className="text-[17px]" style={{ color: OBS.muted }}>
              Potential
            </span>
            <span
              className="text-[24px] font-bold tabular-nums leading-none"
              style={{ color: ACCENTS.amber }}
            >
              {row.max_win}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

export default function NowPlayingObsPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <NowPlaying />
    </Suspense>
  )
}
