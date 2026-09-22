import { SCENE_GRADIENT, SCENE_ORBS } from "@/lib/obs-theme"

/**
 * The ground every full-scene OBS source sits on: a diagonal gradient starting
 * at the column tone in the top-left corner and lifting to the bottom-right,
 * with three slow colour fields drifting over it.
 *
 * Shared rather than copied, because two screens that are "the same background"
 * by coincidence stop being the same background the first time one is touched.
 * /obs/complete and /obs/starting-soon both render this, so cutting to the
 * waiting screen and back does not change what is behind the overlay.
 *
 * The drift is translate-only. No scale and no opacity in the keyframe: a
 * translated layer is rasterised once and then moved by the compositor, whereas
 * scaling one re-runs its 60px blur every frame, on the machine that is also
 * encoding the stream.
 */
export function SceneBackground() {
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
