import type React from "react"

/**
 * Makes every OBS route transparent from the first painted frame.
 *
 * The root layout puts bg-[#0B0B0D] on <body>, and ConditionalLayout swaps it
 * for bg-transparent — but in a useEffect, so it only happens once the client
 * bundle has run. Until then the server-rendered body is opaque near-black,
 * which in a browser source is a full-size dark rectangle over the capture.
 *
 * Usually that is a flash on load and easy to miss. It stops being a flash when
 * the source is set to "Shutdown source when not visible" and re-opens on every
 * scene change, and it never resolves at all if the bundle fails to run — the
 * overlay just sits there opaque with no clue why.
 *
 * A stylesheet in the layout is server-rendered and applies before any of that,
 * so transparency no longer depends on JavaScript having run. `background`
 * rather than `background-color` so a base-layer background-image cannot
 * survive either.
 */
export default function ObsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html,body{background:transparent !important}`}</style>
      {children}
    </>
  )
}
