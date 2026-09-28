"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Who is signed in, as /api/auth/session reports it.
 *
 * Re-read on every navigation, because points move while you browse (a store
 * purchase, a raffle ticket, a payout from the stream) and the top bar is the
 * one place that shows the balance on every page.
 */

export type SiteUser = {
  id: string
  kick_id: string
  username: string
  avatar_url: string | null
  points_balance: number
  created_at: string | null
  updated_at: string | null
  /** From the verified admin session, not from the Kick cookies. */
  is_admin: boolean
}

export function useSiteSession() {
  const pathname = usePathname()
  const [user, setUser] = useState<SiteUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" })
      if (!response.ok) return
      const data = await response.json()
      setUser((data?.user as SiteUser | null) ?? null)
    } catch {
      // Leave whatever was there: a failed refresh is not a sign-out.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  return { user, loading, refresh }
}

/** Ends both sessions (see /api/auth/logout) and starts the page over. */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" })
  } finally {
    window.location.href = "/"
  }
}
