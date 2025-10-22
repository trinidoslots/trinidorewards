"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

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
      <DialogContent className="sm:max-w-md bg-slate-900/95 backdrop-blur border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Welcome to TrinidoRewards</DialogTitle>
          <DialogDescription className="text-slate-400">
            Login with your Kick account to access exclusive features
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Button
            onClick={handleKickLogin}
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold text-base"
          >
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
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">Benefits</span>
            </div>
          </div>

          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Participate in raffles and tournaments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Track your leaderboard position</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Redeem exclusive stream store items</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
