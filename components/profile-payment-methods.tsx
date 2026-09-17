"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Plus, Trash2 } from "lucide-react"

/**
 * Where the user wants to be paid.
 *
 * Everything goes through /api/profile/payment-methods rather than the browser
 * Supabase client: the table has RLS on with no policy, so the anon key cannot
 * read or write it at all, and the route is what establishes whose details
 * these are. That is deliberate — a wallet address is worth more to an attacker
 * than any other row this site holds.
 */

type Method = {
  id: string
  method: string
  label: string | null
  value: string
  is_primary: boolean
}

const OPTIONS = [
  { id: "paypal", name: "PayPal", placeholder: "you@example.com", hint: "" },
  { id: "crypto", name: "Crypto", placeholder: "Wallet address", hint: "Network, e.g. BTC or LTC" },
  { id: "bank", name: "Bank", placeholder: "IBAN or account number", hint: "Bank name" },
  { id: "skrill", name: "Skrill", placeholder: "you@example.com", hint: "" },
  { id: "other", name: "Other", placeholder: "Account", hint: "What it is" },
]

export function ProfilePaymentMethods() {
  const [methods, setMethods] = useState<Method[]>([])
  const [method, setMethod] = useState("paypal")
  const [value, setValue] = useState("")
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = OPTIONS.find((option) => option.id === method) ?? OPTIONS[0]

  const load = useCallback(async () => {
    const response = await fetch("/api/profile/payment-methods", { cache: "no-store" })
    if (!response.ok) return
    const payload = await response.json()
    setMethods((payload.methods ?? []) as Method[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    setError(null)

    const response = await fetch("/api/profile/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, value, label }),
    })
    const payload = await response.json().catch(() => null)
    setBusy(false)

    if (!response.ok) {
      setError(payload?.error ?? "Could not save that payment method")
      return
    }
    setValue("")
    setLabel("")
    await load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/profile/payment-methods?id=${id}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Could not remove that payment method")
      return
    }
    setMethods((current) => current.filter((entry) => entry.id !== id))
  }

  return (
    <Card className="bg-white/[0.022] border-white/[0.08] backdrop-blur">
      <CardHeader className="p-4">
        <CardTitle className="text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment Methods
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <form onSubmit={add} className="space-y-3">
          <div>
            <Label htmlFor="method" className="text-white/60 text-sm">
              Method
            </Label>
            <select
              id="method"
              value={method}
              onChange={(event) => {
                setMethod(event.target.value)
                setLabel("")
              }}
              className="mt-2 flex h-9 w-full rounded-md border border-white/[0.10] bg-white/[0.06] px-3 text-sm text-white outline-none"
            >
              {OPTIONS.map((option) => (
                <option key={option.id} value={option.id} className="bg-[#121216]">
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          {chosen.hint && (
            <div>
              <Label htmlFor="pm-label" className="text-white/60 text-sm">
                {chosen.hint}
              </Label>
              <Input
                id="pm-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="bg-white/[0.06] border-white/[0.10] text-white"
              />
            </div>
          )}

          <div>
            <Label htmlFor="pm-value" className="text-white/60 text-sm">
              Details
            </Label>
            <Input
              id="pm-value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={chosen.placeholder}
              className="bg-white/[0.06] border-white/[0.10] text-white"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <Button type="submit" disabled={busy} className="w-full bg-[#5B8DEF] hover:bg-[#4A7AD8]">
            <Plus className="w-4 h-4 mr-2" />
            {busy ? "Saving..." : "Add Payment Method"}
          </Button>
        </form>

        <div className="space-y-2">
          {methods.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-4">No payment methods added yet</p>
          ) : (
            methods.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-white/[0.04] rounded border border-white/[0.10]"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm capitalize">
                    {entry.method}
                    {entry.label ? ` · ${entry.label}` : ""}
                  </p>
                  <p className="text-white/40 text-xs truncate">{entry.value}</p>
                </div>
                <Button
                  onClick={() => remove(entry.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-white/[0.08]"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
