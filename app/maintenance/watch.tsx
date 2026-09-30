"use client"

import { useEffect } from "react"

const CHECK_MS = 30_000

/** Sends an open maintenance tab back to the site once maintenance is switched off. */
export function MaintenanceWatch() {
  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch("/api/site-status", { cache: "no-store" })
        if (!response.ok) return
        const { maintenance } = (await response.json()) as { maintenance?: boolean }
        if (maintenance === false) window.location.replace("/")
      } catch {
        // Offline or mid-deploy: ask again next time.
      }
    }
    const timer = window.setInterval(check, CHECK_MS)
    return () => window.clearInterval(timer)
  }, [])

  return null
}
