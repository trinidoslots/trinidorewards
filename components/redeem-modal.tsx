"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Coins, Loader2, TicketCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { KickMark } from "@/components/login-modal"
import { startKickLogin } from "@/lib/kick-login"

/** Dispatch on window to open the redeem dialog; `detail` may carry a code to fill in. */
export const OPEN_REDEEM_EVENT = "redeem:open"

export function openRedeem(code?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_REDEEM_EVENT, { detail: code ?? null }))
}

/** Query parameter that opens the dialog on load: /?redeem=CODE (or =1 for an empty box). */
export const REDEEM_PARAM = "redeem"

const cleanCode = (value: string) => value.toUpperCase().replace(/\s+/g, "")

/**
 * Redeem a promo code for points, as a dialog over whatever page you are on.
 *
 * Mounted once, in the site top bar; the account menu opens it with
 * openRedeem(). Old /redeem links (the stream overlay prints one) redirect to
 * /?redeem=CODE, which opens it with the code filled in.
 */
export function RedeemModal({
  open,
  onOpenChange,
  initialCode,
  loggedIn,
  onRedeemed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCode: string
  loggedIn: boolean
  onRedeemed: () => void
}) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ code: string; points: number; balance: number } | null>(null)

  // Fresh each time it opens, with whatever code it was opened for.
  useEffect(() => {
    if (!open) return
    setCode(cleanCode(initialCode))
    setError(null)
    setSuccess(null)
  }, [open, initialCode])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!loggedIn) {
      setBusy(true)
      // Back to this page with the dialog open and the code still in it.
      const url = new URL(window.location.href)
      url.searchParams.set(REDEEM_PARAM, code || "1")
      await startKickLogin(url.pathname + url.search)
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
    onRedeemed()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-white/[0.10] bg-[#0E0E11] p-0 sm:max-w-sm">
        <div className="px-5 pb-1 pt-5">
          <MonoLabel className="text-white/30">Trinido Rewards</MonoLabel>
          <DialogTitle className="mt-2 flex items-center gap-2 text-[19px] font-semibold tracking-tight text-white">
            <TicketCheck className="h-5 w-5" style={{ color: ACCENTS.amber }} />
            Redeem a code
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px] leading-snug text-white/40">
            Got a code from the stream? Turn it into points.
          </DialogDescription>
        </div>

        <form onSubmit={submit} className="space-y-3 p-5">
          <input
            value={code}
            onChange={(e) => {
              setCode(cleanCode(e.target.value))
              setError(null)
            }}
            placeholder="ENTER CODE"
            aria-label="Promo code"
            maxLength={32}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-lg border border-white/[0.10] bg-black/30 px-4 text-center font-mono text-[18px] font-semibold uppercase tracking-[0.18em] text-white outline-none placeholder:text-white/20 focus:border-white/30"
          />

          {loggedIn ? (
            <button
              type="submit"
              disabled={busy || code.length < 3}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.amber }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redeem"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg text-[14px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "#53FC18" }}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <KickMark className="h-4 w-4" /> Log in with Kick to redeem
                </>
              )}
            </button>
          )}

          {error && (
            <p className="text-center text-[13px]" style={{ color: ACCENTS.red }}>
              {error}
            </p>
          )}

          {success && (
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{ borderColor: `${ACCENTS.green}55`, backgroundColor: `${ACCENTS.green}14` }}
            >
              <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: ACCENTS.green }} />
              <div>
                <p className="text-[14px] font-semibold text-white">+{success.points.toLocaleString("en-US")} points</p>
                <p className="text-[12.5px] text-white/45">
                  <span className="font-mono">{success.code}</span> redeemed · balance{" "}
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: ACCENTS.amber }}>
                    <Coins className="h-3 w-3" />
                    {success.balance.toLocaleString("en-US")}
                  </span>
                </p>
              </div>
            </div>
          )}
        </form>

        <p className="border-t border-white/[0.08] px-5 py-3 text-[11px] leading-snug text-white/25">
          Each code can be redeemed once per account.
        </p>
      </DialogContent>
    </Dialog>
  )
}
