"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Sections rise into place as they are scrolled to.
 *
 * Applied to the whole front end at once rather than by hand on every page: it
 * walks the top-level children of the page and stages them. Doing it per page
 * would have meant editing twenty files and forgetting the twenty-first.
 *
 * Nothing is hidden until the observer is actually running. If this never
 * mounts — JavaScript off, a hydration error — the page stays exactly as the
 * server rendered it rather than being invisible.
 */

const STAGGER_MS = 70
/** Past this, a long page would stage its last section a second and a half in. */
const MAX_STAGGER_MS = 420

export function Reveal() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const main = document.querySelector("main")
    if (!main) return

    const seen = new WeakSet<HTMLElement>()

    const observer = new IntersectionObserver(
      (entries, self) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add("is-visible")
          // One reveal each: re-animating on every scroll past is a fidget,
          // not an effect.
          self.unobserve(entry.target)
        }
      },
      // Slightly inside the viewport, so a section is already moving by the
      // time its top edge is comfortably on screen.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    )

    function stage() {
      // Descend past single-child wrappers: <main> holds the page transition,
      // which holds the page, so staging main's own children would stage the
      // whole page as one block and the effect would not be visible at all.
      let container: Element = main!
      for (let depth = 0; depth < 4 && container.children.length === 1; depth++) {
        container = container.children[0]
      }

      const targets = Array.from(container.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      )
      // A page that is one element all the way down has nothing to stage.
      if (targets.length < 2) return

      let index = 0
      for (const node of targets) {
        if (seen.has(node)) {
          index++
          continue
        }
        seen.add(node)
        node.classList.add("reveal")
        node.style.setProperty("--reveal-delay", `${Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}ms`)
        observer.observe(node)
        index++
      }
    }

    stage()

    // Client pages render a loading state first and swap in the real content a
    // moment later. Staging once on navigation would catch the placeholder —
    // a single element, so nothing gets staged at all — and never the page
    // people actually see.
    let queued = 0
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(queued)
      queued = requestAnimationFrame(stage)
    })
    mutations.observe(main, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(queued)
      mutations.disconnect()
      observer.disconnect()
      // Left visible on the way out: a section mid-reveal when you navigate
      // away should not be stranded at opacity 0 by the class hanging around.
      main?.querySelectorAll(".reveal").forEach((node) => node.classList.remove("reveal"))
    }
  }, [pathname])

  return null
}

/**
 * A heading that arrives word by word.
 *
 * Words are wrapped in spans rather than the text being animated as a whole,
 * which is why it reads as focusing rather than sliding. Screen readers still
 * get one continuous string, since the spans carry no semantics and the spaces
 * between words are preserved.
 */
export function WordsIn({
  text,
  className,
  delay = 0,
  step = 55,
}: {
  text: string
  className?: string
  delay?: number
  step?: number
}) {
  const words = text.split(" ")

  return (
    <span className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="word-in" style={{ ["--word-delay" as string]: `${delay + index * step}ms` }}>
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  )
}
