"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

/**
 * Every overlay in one browser source, 1920×1080.
 *
 * The top bar across the top, the bonus hunt down the left, the stream column
 * down the right, and nothing in the middle — that gap is the point, it is
 * where the slot shows through.
 *
 * The three are embedded as frames rather than imported as components. Each one
 * is a page in its own right: it reads its own query string, opens its own
 * Supabase subscriptions and its own Kick socket, and lays itself out against
 * the full height of its source. Rendering them as components in a grid would
 * mean three widgets fighting over one viewport and one set of search params,
 * and every future change to a widget would have to be made to work twice. A
 * frame gives each one exactly the box it already expects.
 */

/** The scene OBS is set to. Everything below is positioned inside this. */
const SCENE = { width: 1920, height: 1080 }
const TOP_BAR_HEIGHT = 50

function Complete() {
  const params = useSearchParams()

  // Widths are the two columns' own sizes, overridable per scene: an overlay
  // gets nudged to fit whatever is behind it.
  //
  // 400 is not a round number picked for looks: the hunt column lays its slots
  // out two across at the 180px the art is drawn at, and 180 + 8 + 180 plus
  // 16px of padding on each side is exactly 400. Narrower and the thumbnails
  // shrink; wider and they sit in a gap.
  const huntWidth = Number(params.get("hunt")) || 400
  const streamWidth = Number(params.get("stream")) || 360
  const channel = params.get("channel")?.trim()
  const preview = params.get("preview") === "1"

  // Passed through so one ?preview=1 on this page previews all three, rather
  // than each having to be opened on its own to be positioned.
  const query = (extra?: string) => {
    const parts: string[] = []
    if (channel) parts.push(`channel=${encodeURIComponent(channel)}`)
    if (preview) parts.push("preview=1")
    if (extra) parts.push(extra)
    return parts.length ? `?${parts.join("&")}` : ""
  }

  const columnHeight = SCENE.height - TOP_BAR_HEIGHT

  return (
    <div
      className="relative overflow-hidden bg-transparent"
      style={{ width: SCENE.width, height: SCENE.height }}
    >
      <Frame
        title="Top bar"
        src={`/obs/top-bar${query()}`}
        style={{ top: 0, left: 0, width: SCENE.width, height: TOP_BAR_HEIGHT }}
      />

      <Frame
        title="Bonus hunt"
        src={`/obs/hunt${query()}`}
        style={{ top: TOP_BAR_HEIGHT, left: 0, width: huntWidth, height: columnHeight }}
      />

      <Frame
        title="Stream column"
        src={`/obs/stream${query()}`}
        style={{ top: TOP_BAR_HEIGHT, right: 0, width: streamWidth, height: columnHeight }}
      />
    </div>
  )
}

/** One embedded source, positioned absolutely in the scene. */
function Frame({ title, src, style }: { title: string; src: string; style: React.CSSProperties }) {
  return (
    <iframe
      title={title}
      src={src}
      // Transparent so the gap between the columns stays the gameplay, not a
      // black rectangle. OBS composites what it is given; a frame that paints
      // its own background would cover the capture underneath.
      allowTransparency
      scrolling="no"
      className="absolute border-0 bg-transparent"
      style={style}
    />
  )
}

export default function CompleteOverlayPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div style={{ width: SCENE.width, height: SCENE.height }} />}>
      <Complete />
    </Suspense>
  )
}
