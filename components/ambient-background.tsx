"use client"

/**
 * The ground the pages sit on: flat near-black under one faint cone of light
 * from the top of the screen.
 *
 * It used to be a drifting grid and three coloured orbs. The sites the
 * redesign takes after (Linear, Vercel, Railway, Modal) keep the ground still
 * and spend light only where something is — so this is now static, and the
 * pages draw their own glows next to the things they want looked at.
 *
 * Fixed and pointer-events-none, so it costs nothing in layout and never
 * intercepts a click.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute left-1/2 top-[-280px] h-[560px] w-[1200px] max-w-[160vw] -translate-x-1/2"
        style={{ background: "radial-gradient(closest-side, rgb(255 255 255 / 0.05), transparent)" }}
      />
    </div>
  )
}
