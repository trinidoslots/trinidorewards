"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AuthShell, Field, FormError, SubmitButton } from "@/components/auth-shell"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const params = useSearchParams()

  // The middleware sends you here from wherever you were headed. Going back to
  // /admin afterwards would lose that, so the page you asked for is carried
  // through the round-trip — but only as a path on this site, never an
  // arbitrary URL somebody put in the query string.
  const nextParam = params.get("next")
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(next)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell title="Admin" subtitle="Sign in to reach the admin panel.">
      <form onSubmit={handleLogin} className="space-y-4">
        <Field
          label="Email"
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={error} />
        <SubmitButton busy={isLoading}>{isLoading ? "Signing in…" : "Sign in"}</SubmitButton>
      </form>
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
