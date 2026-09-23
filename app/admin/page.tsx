"use client"

import { useEffect, useState } from "react"
import { DashboardView } from "@/components/admin/dashboard-view"
import type { DashboardPayload } from "@/lib/admin-dashboard"

/**
 * The admin overview.
 *
 * Fetching only; everything on screen is in DashboardView. One request for the
 * whole page — this used to open the database straight from the browser with
 * the public anon key, a query per panel, each waiting on the last.
 */
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch("/api/admin/dashboard", { cache: "no-store" })
        const payload = await response.json()
        if (cancelled) return

        if (!response.ok) {
          setError(payload.error ?? "Could not load the overview.")
          return
        }

        setData(payload as DashboardPayload)
        setError(null)
      } catch {
        if (!cancelled) setError("Could not reach the server.")
      }
    }

    load()

    // Slow on purpose. Nothing here is a live readout — it is a set of
    // standings and a queue, and one that reshuffles under the cursor is
    // worse than one that is a minute old.
    const poll = setInterval(load, 60_000)

    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [])

  return <DashboardView data={data} error={error} />
}
