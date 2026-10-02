"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, AlertTriangle, X } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { AUTH_ERRORS } from "@/lib/auth-errors"

/**
 * One line at the bottom of the screen after a sign-in round-trip.
 *
 * The callbacks send people back with ?auth_error=<code> (or ?connected=discord);
 * this says what happened and takes the parameter off the address, so a
 * reload or a shared link does not say it again. Unknown codes get a general
 * sentence rather than nothing.
 */
export function AuthNotice() {
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const error = url.searchParams.get("auth_error")
    const connected = url.searchParams.get("connected")
    if (!error && !connected) return

    setNotice(
      error
        ? { tone: "error", text: AUTH_ERRORS[error] ?? "Signing in did not go through. Try again." }
        : { tone: "ok", text: connected === "discord" ? "Discord is connected. You can now sign in with it too." : "Connected." },
    )
    url.searchParams.delete("auth_error")
    url.searchParams.delete("connected")
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)

    const timer = window.setTimeout(() => setNotice(null), 9000)
    return () => window.clearTimeout(timer)
  }, [])

  const color = notice?.tone === "ok" ? ACCENTS.green : ACCENTS.amber

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-4 bottom-5 z-[95] mx-auto flex max-w-lg items-start gap-3 rounded-xl border bg-[#0E0E12]/95 px-4 py-3.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur"
          style={{ borderColor: `${color}55` }}
        >
          {notice.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
          )}
          <p className="flex-1 text-[13.5px] leading-relaxed text-white/85">{notice.text}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="rounded p-1 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
