"use client"

import type React from "react"
import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

const SLOW_NAV_THRESHOLD_MS = 150
const MIN_OVERLAY_VISIBLE_MS = 250
const MAX_OVERLAY_MS = 8000

/**
 * Detects same-origin, same-tab internal link clicks and, only if the
 * resulting navigation takes longer than SLOW_NAV_THRESHOLD_MS to commit,
 * shows a full-viewport loading overlay so slower navigations get explicit
 * feedback instead of an abrupt content swap. Fast/cached navigations never
 * show anything.
 *
 * useSearchParams() requires a Suspense boundary to avoid forcing static
 * pages (like /_not-found) into dynamic rendering during build, so the
 * actual implementation lives in an inner component wrapped in Suspense.
 */
export function RouteTransitionOverlay({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <RouteTransitionOverlayInner>{children}</RouteTransitionOverlayInner>
    </Suspense>
  )
}

function RouteTransitionOverlayInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)

  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minVisibleUntilRef = useRef<number>(0)
  const currentKeyRef = useRef<string>("")

  const key = `${pathname}?${searchParams.toString()}`
  currentKeyRef.current = key

  useEffect(() => {
    function clearSlowTimer() {
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current)
        slowTimerRef.current = null
      }
    }

    function clearMaxTimer() {
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current)
        maxTimerRef.current = null
      }
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const anchor = target?.closest("a")
      if (!anchor) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return

      const targetKey = `${url.pathname}?${url.searchParams.toString()}`
      if (targetKey === currentKeyRef.current) return

      clearSlowTimer()
      clearMaxTimer()

      slowTimerRef.current = setTimeout(() => {
        setNavigating(true)
        minVisibleUntilRef.current = Date.now() + MIN_OVERLAY_VISIBLE_MS
        maxTimerRef.current = setTimeout(() => setNavigating(false), MAX_OVERLAY_MS)
      }, SLOW_NAV_THRESHOLD_MS)
    }

    document.addEventListener("click", handleClick, true)
    return () => {
      document.removeEventListener("click", handleClick, true)
      clearSlowTimer()
      clearMaxTimer()
    }
  }, [])

  useEffect(() => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current)
      slowTimerRef.current = null
    }

    if (!navigating) return

    const remaining = Math.max(0, minVisibleUntilRef.current - Date.now())
    const hideTimer = setTimeout(() => {
      setNavigating(false)
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current)
        maxTimerRef.current = null
      }
    }, remaining)

    return () => clearTimeout(hideTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  return (
    <>
      <motion.div
        animate={{ opacity: navigating ? 0.25 : 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        aria-hidden={navigating || undefined}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {navigating && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0B0D]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="status"
            aria-live="polite"
            aria-label="Loading page"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#5B8DEF]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">Loading</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
