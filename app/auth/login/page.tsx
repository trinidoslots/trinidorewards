"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AuthShell, FormError } from "@/components/auth-shell"
import { KickMark } from "@/components/login-modal"
import { startKickLogin } from "@/lib/kick-login"

/** Kick's green, as on the site's own login dialog. */
const KICK_GREEN = "#53FC18"

type Session = { user: { username: string } | null; is_admin?: boolean }

/**
 * The admin panel's door.
 *
 * There is no email login any more: the panel opens for a Kick account that
 * is tagged as an admin (scripts/070, /admin/users). The middleware sends you
 * here from any /admin page it would not serve, with the page you wanted in
 * ?next, and the Kick login brings you back to it.
 */
function LoginForm() {
  const params = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  // Only a path on this site survives the round-trip, never a URL someone put
  // in the query string. The callback checks this again.
  const nextParam = params.get("next")
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin"

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Session) => setSession(data))
      .catch(() => setSession({ user: null }))
  }, [])

  // Says why you are here rather than just showing the button again: the
  // usual reason, once someone is signed in, is that their account is not
  // tagged, and signing in a second time would change nothing.
  let problem: string | null = null
  if (params.get("error") === "admin_session") {
    problem = "Kick signed you in, but the admin session could not be opened. Try again; if it keeps happening, check the server log."
  } else if (session?.user && !session.is_admin) {
    problem = `You are signed in as ${session.user.username}, which is not an admin account. Sign in with the Kick account that has admin access.`
  }

  const signIn = async () => {
    setBusy(true)
    await startKickLogin(next)
  }

  return (
    <AuthShell title="Admin" subtitle="Sign in with the Kick account that has admin access.">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg text-[14px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: KICK_GREEN }}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to Kick…
            </>
          ) : (
            <>
              <KickMark className="h-4 w-4" />
              Continue with Kick
            </>
          )}
        </button>
        <FormError message={problem} />
        <p className="text-[11px] leading-relaxed text-white/30">
          Admin access is given per Kick account under Users in the panel. There is no separate password.
        </p>
      </div>
    </AuthShell>
  )
}

export default function LoginPage() {
  // useSearchParams needs a suspense boundary to keep this page prerenderable.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0B0D]" />}>
      <LoginForm />
    </Suspense>
  )
}
