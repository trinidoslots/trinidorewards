"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { COLUMN_EDGE, COLUMN_GRADIENT, SCENE_GRADIENT, SCENE_ORBS } from "@/lib/obs-theme"

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

  /**
   * ?gap=1 leaves the middle of the scene unpainted.
   *
   * The scene background fills all 1920x1080, so on its own this source now
   * covers whatever is behind it. That is right when it is the bottom layer in
   * OBS and the slot capture sits on top of it, and wrong when it is the top
   * layer over a full-screen capture — in that case the middle has to stay
   * empty, which is what this switches back to. The columns and the bar are
   * unaffected either way.
   */
  const gap = params.get("gap") === "1"

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

  // Everything the stream column alone understands has to be forwarded to it,
  // or running /obs/complete instead of /obs/stream quietly drops the feature
  // with nothing to say it did.
  //
  //   recorder — the column is the one that reads chat, and without the token
  //              it stops recording chat activity.
  //   ping / volume — the announcements live in this column, so this is the
  //              only frame that can make the sound.
  const streamExtras: string[] = []
  const recorder = params.get("recorder")?.trim()
  if (recorder) streamExtras.push(`recorder=${encodeURIComponent(recorder)}`)

  const ping = params.get("ping")?.trim()
  if (ping) streamExtras.push(`ping=${encodeURIComponent(ping)}`)

  const volume = params.get("volume")?.trim()
  if (volume) streamExtras.push(`volume=${encodeURIComponent(volume)}`)

  const streamQuery = streamExtras.length ? `${columnQuery}&${streamExtras.join("&")}` : columnQuery

  const columnHeight = SCENE.height - TOP_BAR_HEIGHT

  return (
    <div
      className="relative overflow-hidden bg-transparent"
      style={{ width: SCENE.width, height: SCENE.height }}
    >
      {!gap && <SceneBackground />}

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
 * The scene's ground: a diagonal gradient with three slow colour fields on it.
 *
 * Painted here rather than inside any of the three sources, because it is one
 * surface spanning the whole 1920x1080 and each source only knows about its own
 * box. It is also the reason the columns are no longer trying to continue the
 * bar's gradient — there is something behind them now for them to sit on.
 *
 * Rendered first, so the bar and the columns paint over it on DOM order alone.
 */
function SceneBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundImage: SCENE_GRADIENT, zIndex: 0 }}
    >
      {SCENE_ORBS.map((orb) => (
        <div
          key={orb.color}
          className="obs-scene-orb absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.left,
            top: orb.top,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            opacity: orb.opacity,
            filter: "blur(60px)",
            // alternate, so it eases back rather than snapping to the start —
            // a jump every 37 seconds is exactly the kind of thing that is
            // invisible in a preview and obvious on a stream.
            animation: `obs-scene-drift ${orb.duration} ease-in-out infinite alternate`,
            willChange: "transform",
          }}
        />
      ))}
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
