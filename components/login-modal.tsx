"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Trophy, Gift } from "lucide-react"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleKickLogin = async () => {
    setIsLoading(true)

    const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/callback/kick`
    const state = generateRandomString(16)

    const codeVerifier = generateRandomString(128)
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    console.log("[v0] OAuth Flow Starting:")
    console.log("[v0] Client ID:", clientId)
    console.log("[v0] Redirect URI:", redirectUri)
    console.log("[v0] State:", state)
    console.log("[v0] Code Verifier Length:", codeVerifier.length)
    console.log("[v0] Code Challenge:", codeChallenge)

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

    console.log("[v0] Full OAuth URL:", authUrl.toString())

    window.location.href = authUrl.toString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 backdrop-blur border-slate-700/50 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
            <div>
              <DialogTitle className="text-2xl text-white font-bold">Welcome Back!</DialogTitle>
              <p className="text-xs text-emerald-400 font-medium">Join the TrinidoRewards community</p>
            </div>
          </div>
          <DialogDescription className="text-slate-400">
            Connect your Kick account to unlock exclusive rewards and features
          </DialogDescription>
          {/* </CHANGE> */}
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Button
            onClick={handleKickLogin}
            disabled={isLoading}
            className="relative w-full h-14 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 hover:from-green-400 hover:via-emerald-400 hover:to-green-400 text-white font-bold text-base shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                </svg>
                Login with Kick
                <Sparkles className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          {/* </CHANGE> */}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">Unlock Features</span>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Gift className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-slate-300">Enter exclusive raffles</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-slate-300">Compete in tournaments & climb ranks</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-slate-300">Redeem points for stream rewards</span>
            </div>
          </div>
          {/* </CHANGE> */}
        </div>
      </DialogContent>
    </Dialog>
  )
}
