"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Coins, Loader2, TicketCheck } from "lucide-react"
import { PageBody, PageHero } from "@/components/page-hero"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
import { LoginModal } from "@/components/login-modal"
import { SESSION_REFRESH_EVENT, useSiteSession } from "@/hooks/use-site-session"

/**
 * Redeem a promo code for points.
 *
 * Reachable from the account menu, and as trinidorewards.com/redeem from the
 * stream overlay. ?code=XYZ fills the box, so a link can carry the code.
 */
function RedeemForm() {
  const params = useSearchParams()
  const { user, loading } = useSiteSession()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ code: string; points: number; balance: number } | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    const fromLink = params.get("code")
    if (fromLink) setCode(fromLink.toUpperCase().replace(/\s+/g, ""))
  }, [params])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) {
      setLoginOpen(true)
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    const res = await fetch("/api/promo/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(json.error ?? "Could not redeem that code.")
      return
    }
    setSuccess(json)
    setCode("")
    // The top bar's balance only re-reads on navigation; this is not one.
    window.dispatchEvent(new Event(SESSION_REFRESH_EVENT))
  }

  return (
    <div>
      <PageHero accent="amber" title="Redeem a code" subtitle="Got a code from the stream? Turn it into points." />
      <PageBody>
        <div className="mx-auto max-w-md space-y-3">
          <Panel accent="amber" className="p-5">
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <MonoLabel className="text-white/40">Promo code</MonoLabel>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))
                    setError(null)
                  }}
                  placeholder="ENTER CODE"
                  maxLength={32}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 h-12 w-full rounded-lg border border-white/[0.10] bg-black/30 px-4 text-center font-mono text-[18px] font-semibold uppercase tracking-[0.18em] text-white outline-none placeholder:text-white/20 focus:border-white/30"
                />
              </label>

              <button
                type="submit"
                disabled={busy || (!!user && code.length < 3)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: ACCENTS.amber }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : user || loading ? (
                  <>
                    <TicketCheck className="h-4 w-4" /> Redeem
                  </>
                ) : (
                  "Log in with Kick to redeem"
                )}
              </button>

              {error && (
                <p className="text-center text-[13px]" style={{ color: ACCENTS.red }}>
                  {error}
                </p>
              )}
            </form>
          </Panel>

          {success && (
            <Panel accent="green" className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: ACCENTS.green }} />
              <div>
                <p className="text-[14px] font-semibold text-white">
                  +{success.points.toLocaleString("en-US")} points
                </p>
                <p className="text-[12.5px] text-white/45">
                  <span className="font-mono">{success.code}</span> redeemed · new balance{" "}
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: ACCENTS.amber }}>
                    <Coins className="h-3 w-3" />
                    {success.balance.toLocaleString("en-US")}
                  </span>
                </p>
              </div>
            </Panel>
          )}

          <p className="text-center text-[12px] text-white/30">Each code can be redeemed once per account.</p>
        </div>
      </PageBody>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}

export default function RedeemPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <RedeemForm />
    </Suspense>
  )
}
