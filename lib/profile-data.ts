"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * The profile's tab data, fetched once and kept.
 *
 * Each tab used to fetch when it mounted, and the tab slide mounts a tab
 * every time it is opened — so every switch showed a placeholder, then the
 * content, and the height jumped. Now each address is fetched once (the
 * profile starts all of them in the background as soon as it has loaded),
 * kept for the visit, and a tab opened again shows its data at once.
 *
 * After a change (an account added, a wallet removed) the panel calls
 * reload(), which refetches and updates everyone using that address.
 */

const cache = new Map<string, unknown>()
const pending = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<(value: unknown) => void>>()

async function load(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

/** Fetch now unless it is already here or on its way. */
export function prefetchProfile(url: string): Promise<unknown> {
  if (cache.has(url)) return Promise.resolve(cache.get(url))
  const inFlight = pending.get(url)
  if (inFlight) return inFlight
  const promise = load(url)
    .then((value) => {
      cache.set(url, value)
      for (const listener of listeners.get(url) ?? []) listener(value)
      return value
    })
    .finally(() => pending.delete(url))
  pending.set(url, promise)
  return promise
}

/** The profile's tab addresses, started together once the profile is in. */
export const PROFILE_TAB_DATA = [
  "/api/profile/predictions",
  "/api/profile/tournaments",
  "/api/profile/wins",
  "/api/profile/connections",
  "/api/profile/site-usernames",
  "/api/profile/payment-methods",
]

export function prefetchProfileTabs() {
  for (const url of PROFILE_TAB_DATA) void prefetchProfile(url).catch(() => {})
}

export function useProfileData<T>(url: string): { data: T | null; failed: boolean; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(() => (cache.has(url) ? (cache.get(url) as T) : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const listener = (value: unknown) => setData(value as T)
    const set = listeners.get(url) ?? new Set()
    set.add(listener)
    listeners.set(url, set)
    if (cache.has(url)) setData(cache.get(url) as T)
    else
      prefetchProfile(url).catch(() => {
        setFailed(true)
      })
    return () => {
      set.delete(listener)
    }
  }, [url])

  const reload = useCallback(async () => {
    cache.delete(url)
    try {
      await prefetchProfile(url)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [url])

  return { data, failed, reload }
}
