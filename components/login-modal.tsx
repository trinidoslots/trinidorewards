"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Gift, Loader2, ShoppingBag, Swords } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Kick's green. The one thing on this dialog that is not the board palette. */
const KICK_GREEN = "#53FC18"

function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let text = ""
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

/** Kick's blocky K, drawn rather than loaded so the dialog has no dependency. */
function KickMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2 3h6v5h3V5.5h3V3h6v6h-3v3h-3v3h3v3h3v6h-6v-2.5h-3V19H8v5H2V3z" />
    </svg>
  )
}

const PERKS = [
  { icon: Gift, label: "Enter raffles and giveaways", accent: ACCENTS.purple },
  { icon: Swords, label: "Play the bonus battles", accent: ACCENTS.amber },
  { icon: ShoppingBag, label: "Spend points in the store", accent: ACCENTS.green },
]

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleKickLogin = async () => {
    setIsLoading(true)

    const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/callback/kick`
    const state = generateRandomString(16)

    const codeVerifier = generateRandomString(128)
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    sessionStorage.setItem("kick_oauth_state", state)
    document.cookie = `kick_code_verifier=${codeVerifier}; path=/; max-age=600; SameSite=Lax`

    const authUrl = new URL("https://id.kick.com/oauth/authorize")
    authUrl.searchParams.set("client_id", clientId!)
    authUrl.searchParams.set("redirect_uri", redirectUri)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("state", state)
    authUrl.searchParams.set("scope", "user:read")
    authUrl.searchParams.set("code_challenge", codeChallenge)
    authUrl.searchParams.set("code_challenge_method", "S256")

    window.location.href = authUrl.toString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-white/[0.10] bg-[#0E0E11] p-0 sm:max-w-sm">
        <div className="px-5 pb-1 pt-5">
          <MonoLabel className="text-white/30">Trinido Rewards</MonoLabel>
          <DialogTitle className="mt-2 text-[19px] font-semibold tracking-tight text-white">
            Sign in with Kick
          </DialogTitle>
          {/* DialogDescription rather than a plain <p>: Radix wires it to
              aria-describedby, and warns when a dialog has neither. */}
          <DialogDescription className="mt-1 text-[13px] leading-snug text-white/40">
            Your Kick account is the login — there is no separate password to keep.
          </DialogDescription>
        </div>

        <div className="p-5">
          <button
            type="button"
            onClick={handleKickLogin}
            disabled={isLoading}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg text-[14px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: KICK_GREEN }}
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

          <ul className="mt-5 space-y-2.5 border-t border-white/[0.08] pt-4">
            {PERKS.map((perk) => (
              <li key={perk.label} className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${perk.accent}1f` }}
                >
                  <perk.icon className="h-3.5 w-3.5" style={{ color: perk.accent }} />
                </span>
                <span className="text-[13px] text-white/55">{perk.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-white/[0.08] px-5 py-3 text-[11px] leading-snug text-white/25">
          We only ask Kick for your username and picture. Nothing is posted on your behalf.
        </p>
      </DialogContent>
    </Dialog>
  )
}
