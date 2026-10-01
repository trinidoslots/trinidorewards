import type React from "react"
import { Gift } from "lucide-react"

/**
 * The site's prize artwork, whole, at the edge of the card that holds it.
 *
 * The bundled artwork (public/raffles, public/tournaments) is itself a
 * finished card: 1600x1000, corners rounded at ~51px with transparent pixels
 * outside them, a 2px border and a blue bar down the left. Set on a dark
 * backing, those transparent corners showed as dark notches along the bottom
 * of every picture. So there is no backing: the picture runs to the card's
 * border, in a frame of exactly its own 8:5 shape, clipped to exactly its own
 * corner radius — 51/1600 of the width by 51/1000 of the height, as a
 * percentage radius so it holds at any size.
 *
 * The cards around it take their corner radius from the same 3.2%, measured
 * on themselves (container units, globals.css), so the card's corners and the
 * picture's are one curve at any width. A fixed card radius matched only at
 * one size: two different curves meeting at a corner read as a mistake.
 *
 * object-contain, not cover: an uploaded picture of another shape is shown
 * whole rather than cropped. `inset={false}` is for thumbnails, where the
 * frame is the thumbnail.
 */

/** The artwork's own corners: ~51px on a 1600x1000 card, as percentages. */
export const ART_RADIUS = "rounded-[3.2%/5.1%]"

export function ArtImage({
  src,
  className,
  inset = true,
  frame: shape = ART_RADIUS,
  icon: Icon = Gift,
}: {
  src: string | null
  className?: string
  inset?: boolean
  frame?: string
  /** What stands in when there is no picture. */
  icon?: React.ComponentType<{ className?: string }>
}) {
  const frame = (
    <div className={`relative aspect-[8/5] w-full overflow-hidden ${shape}`}>
      {src ? (
        /*
         * scale 1.005: the artwork draws its own 2px border (at 1600px), which
         * sat just inside the card's border as a second line — doubled where
         * the two curves run side by side at the top corners. Half a percent
         * larger puts the artwork's border just outside the frame on every
         * side, at any size, and leaves most of the blue bar inside it.
         */
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, any host
        <img src={src} alt="" className="h-full w-full scale-[1.005] object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-10 w-10 text-white/15" />
        </div>
      )}
    </div>
  )
  return inset ? <div className={className}>{frame}</div> : frame
}
