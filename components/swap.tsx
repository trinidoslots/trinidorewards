"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, useAnimationControls } from "framer-motion"
import { AutoHeight } from "@/components/auto-height"

/**
 * Cross-fades between whatever it is given, and eases the height across the
 * change.
 *
 * The earlier version only faded the incoming content in. The outgoing content
 * was gone in the same frame the new content arrived, so a switch was a
 * disappearance followed by an arrival — which is why it kept reading as
 * abrupt however the timing was tuned. This holds the old content on screen
 * and fades it out first.
 *
 * Doing that means Swap has to own *when* the new children are shown, not just
 * how they arrive. Once `on` changes, the previous render's children are
 * pinned and kept on screen until the exit finishes; only then does the
 * current `children` get to render.
 */

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

/**
 * useLayoutEffect on the client, useEffect on the server.
 *
 * It has to be the layout one. useEffect runs after the browser has painted,
 * so the frame order was: React commits the new board, the browser paints it
 * at full opacity, and only then does the effect hide it. Measured, one frame
 * showed the new title fully visible and the next showed it gone — the name
 * changing a beat before its own animation.
 *
 * Tab clicks hid this. React flushes passive effects before paint when the
 * update comes from a discrete event, so the hunt tabs looked fine; the
 * leaderboard commits its swap from a fetch callback, which gets no such
 * treatment. useLayoutEffect runs after commit and before paint either way.
 *
 * React warns about useLayoutEffect during server rendering, where it cannot
 * run at all, so on the server it falls back to the one that is also a no-op.
 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export function Swap({
  on,
  ready = true,
  children,
  className,
  distance = 8,
  /** Seconds for the outgoing half. Short: nobody is reading it on its way out. */
  exitDuration = 0.18,
  /** Seconds for the incoming half, and for the height that moves with it. */
  enterDuration = 0.34,
}: {
  /** Change this to cross-fade — a tab id, a selected row, anything. */
  on: string | number
  /**
   * Whether the content for the current `on` has actually arrived.
   *
   * Leave it alone for a plain tab switch. Pass it when the new content
   * depends on a fetch: the exit then starts on the click, and the entry waits
   * for the data. Without it the leaderboard sat still for the length of a
   * round trip before anything moved, which reads as a dropped click.
   */
  ready?: boolean
  children: React.ReactNode
  className?: string
  distance?: number
  exitDuration?: number
  enterDuration?: number
}) {
  const controls = useAnimationControls()

  /** The children as they were last rendered, so the old ones can be pinned. */
  const previous = useRef({ on, children })
  /** Set while the old content is on its way out; null the rest of the time. */
  const [leaving, setLeaving] = useState<{ on: string | number; children: React.ReactNode } | null>(null)
  /** Guards against a second switch landing mid-transition. */
  const run = useRef(0)
  const first = useRef(true)
  /** Faded out and holding, because the new content is not here yet. */
  const [held, setHeld] = useState(false)

  useIsoLayoutEffect(() => {
    const changed = previous.current.on !== on
    const snapshot = previous.current
    previous.current = { on, children }

    // The first render is an arrival, not a switch. Animating it would fight
    // whatever brought the page in.
    if (first.current) {
      first.current = false
      return
    }
    if (!changed) return

    const generation = ++run.current

    // Pin the old content before the browser can paint the new. setState in a
    // layout effect re-renders synchronously, so this frame never reaches the
    // screen showing the wrong thing.
    setLeaving(snapshot)
    // Drop any hold left by a previous switch. Without this, a switch made
    // while the last one was still waiting for its data could have that data
    // arrive mid-exit and start the entry over the top of it.
    setHeld(false)
    controls.set({ opacity: 1, y: 0 })

    void controls
      .start({ opacity: 0, y: -distance, transition: { duration: exitDuration, ease: EASE } })
      .then(() => {
        // A newer switch already took over; that one owns the animation now.
        if (run.current !== generation) return
        controls.set({ opacity: 0, y: distance })
        setHeld(true)
      })
  }, [on, children, controls, distance, exitDuration, enterDuration])

  // Faded out, and the content it was waiting for has arrived. Unpin the old
  // children and let the new ones rise. When `ready` is not used this runs on
  // the very next commit after the exit, so a tab switch is uninterrupted.
  useIsoLayoutEffect(() => {
    if (!held || !ready) return
    setHeld(false)
    setLeaving(null)
    void controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: enterDuration, ease: EASE },
    })
  }, [held, ready, controls, enterDuration])

  return (
    <AutoHeight className={className} duration={enterDuration} ease={EASE}>
      <motion.div initial={false} animate={controls}>
        {leaving ? leaving.children : children}
      </motion.div>
    </AutoHeight>
  )
}
