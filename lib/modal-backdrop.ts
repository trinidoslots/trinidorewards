/**
 * How a popup's dimmed, blurred backdrop comes in and goes out.
 *
 * The backdrops used to fade their whole layer (opacity) with the blur set on
 * it. Chrome does not blur a layer while its opacity is animating: the page
 * showed through sharp for the length of the fade, then the blur snapped on —
 * the flicker when a popup opened. Animating the darkness and the blur
 * themselves, from none to full, keeps the layer opaque the whole time, so the
 * page dims and softens together.
 *
 * Spread onto the backdrop's motion.div, which must not set its own
 * background or backdrop-blur classes.
 */

const hidden = {
  backgroundColor: "rgba(0, 0, 0, 0)",
  backdropFilter: "blur(0px)",
  WebkitBackdropFilter: "blur(0px)",
}

const shown = {
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
}

export const MODAL_BACKDROP = {
  initial: hidden,
  animate: shown,
  exit: hidden,
  transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
}
