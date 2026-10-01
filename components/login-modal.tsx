"use client"

import { useState } from "react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Gift, Loader2, ShoppingBag, Target, Trophy, X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { startKickLogin } from "@/lib/kick-login"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Kick's green. The one thing on this dialog that is not the board palette. */
const KICK_GREEN = "#53FC18"

/** Kick's blocky K, drawn rather than loaded so the dialog has no dependency. */
export function KickMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2 3h6v5h3V5.5h3V3h6v6h-3v3h-3v3h3v3h3v6h-6v-2.5h-3V19H8v5H2V3z" />
    </svg>
  )
}

/** What signing in opens up, each in the accent its page uses. */
const PERKS = [
  { icon: Gift, label: "Enter raffles", accent: ACCENTS.purple },
  { icon: Trophy, label: "Join tournaments", accent: ACCENTS.amber },
  { icon: Target, label: "Complete challenges", accent: ACCENTS.blue },
  { icon: ShoppingBag, label: "Spend points in the store", accent: ACCENTS.pink },
]

/**
 * Sign in, in the site's own language: the page header's wash and grid at the
 * top in Kick green, a display title, and the one button that matters.
 */
export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleKickLogin = async () => {
    setIsLoading(true)
    await startKickLogin(window.location.pathname + window.location.search)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl border-white/[0.10] bg-[#0E0E12] p-0 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] sm:max-w-[26rem]"
      >
        <div className="relative overflow-hidden border-b border-white/[0.07] px-6 pb-6 pt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(420px 220px at 85% -30%, ${KICK_GREEN}26, transparent 65%)` }}
          />
          <div
            aria-hidden
            className="hero-grid pointer-events-none absolute inset-0"
            style={{
              maskImage: "radial-gradient(ellipse 80% 100% at 80% 0%, #000 20%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 100% at 80% 0%, #000 20%, transparent 75%)",
            }}
          />

          <DialogClose
            className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogClose>

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: KICK_GREEN }} />
              <MonoLabel style={{ color: KICK_GREEN }}>TrinidoRewards</MonoLabel>
            </div>
            <DialogTitle className="mt-4 text-[34px] font-black uppercase leading-[0.95] tracking-[-0.01em] text-white">
              Sign in
            </DialogTitle>
            {/* DialogDescription rather than a plain <p>: Radix wires it to
                aria-describedby, and warns when a dialog has neither. */}
            <DialogDescription className="mt-3 text-[14px] leading-relaxed text-white/50">
              Your Kick account is the login. There is no separate password to keep.
            </DialogDescription>
          </div>
        </div>

        <div className="px-6 py-6">
          <button
            type="button"
            onClick={handleKickLogin}
            disabled={isLoading}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-md text-[15px] font-bold text-black transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: KICK_GREEN, boxShadow: `0 12px 40px -14px ${KICK_GREEN}aa` }}
          >
            {isLoading ? (
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

          <MonoLabel className="mt-6 block text-white/40">Signed in, you can</MonoLabel>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {PERKS.map((perk) => (
              <li
                key={perk.label}
                className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${perk.accent}1f` }}
                >
                  <perk.icon className="h-3.5 w-3.5" style={{ color: perk.accent }} />
                </span>
                <span className="text-[13px] font-medium leading-tight text-white/75">{perk.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-white/[0.07] px-6 py-4 text-[12px] leading-relaxed text-white/40">
          We only ask Kick for your username and picture. Nothing is posted on your behalf.
        </p>
      </DialogContent>
    </Dialog>
  )
}
