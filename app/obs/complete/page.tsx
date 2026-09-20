"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { COLUMN_EDGE, COLUMN_GRADIENT } from "@/lib/obs-theme"

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
  // 214 is not a round number picked for looks: the hunt column lays its slots
  // out two across at 87px, the size they were when three fitted in the old
  // 300px box, and 87 + 8 + 87 plus 8px of list padding and 8px of shell
  // padding each side is exactly 214. Narrower and the thumbnails shrink;
  // wider and they sit in a gap.
  const huntWidth = Number(params.get("hunt")) || 214
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

  // The columns run transparent so the gradient painted behind them is not
  // hidden under each widget's own 92%-opaque shell. Three flat panels read as
  // three widgets that happen to be adjacent; one gradient per column, starting
  // where the top bar leaves off, reads as one overlay.
  const columnQuery = query("transparent=1")

  // The stream column is the one that reads chat, so a ?recorder=<token> on the
  // combined scene has to reach it — otherwise running /obs/complete instead of
  // /obs/stream would silently stop recording chat activity.
  const recorder = params.get("recorder")?.trim()
  const streamQuery = recorder
    ? `${columnQuery}&recorder=${encodeURIComponent(recorder)}`
    : columnQuery

  const columnHeight = SCENE.height - TOP_BAR_HEIGHT

  return (
    <div
      className="relative overflow-hidden bg-transparent"
      style={{ width: SCENE.width, height: SCENE.height }}
    >
      <Frame
        title="Top bar"
        src={`/obs/top-bar${query("embedded=1")}`}
        style={{ top: 0, left: 0, width: SCENE.width, height: TOP_BAR_HEIGHT }}
      />

      <Column style={{ top: TOP_BAR_HEIGHT, left: 0, width: huntWidth, height: columnHeight }} edge="right">
        <Frame title="Bonus hunt" src={`/obs/hunt${columnQuery}`} style={{ inset: 0, width: "100%", height: "100%" }} />
      </Column>

      <Column style={{ top: TOP_BAR_HEIGHT, right: 0, width: streamWidth, height: columnHeight }} edge="left">
        <Frame title="Stream column" src={`/obs/stream${streamQuery}`} style={{ inset: 0, width: "100%", height: "100%" }} />
      </Column>
    </div>
  )
}

/**
 * The painted column a widget sits in.
 *
 * The gradient lives out here rather than inside each widget because it has to
 * start from the same tone on both sides and at the same y — three widgets each
 * drawing their own would drift the moment one of them changed. `edge` is the
 * side facing the gameplay, which gets the site's hairline; the outer side is
 * the edge of the screen and needs nothing.
 */
function Column({
  style,
  edge,
  children,
}: {
  style: React.CSSProperties
  edge: "left" | "right"
  children: React.ReactNode
}) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        ...style,
        backgroundImage: COLUMN_GRADIENT,
        [edge === "right" ? "borderRight" : "borderLeft"]: `1px solid ${COLUMN_EDGE}`,
      }}
    >
      {children}
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
