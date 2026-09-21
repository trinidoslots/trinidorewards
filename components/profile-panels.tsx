"use client"

import { useCallback, useEffect, useState } from "react"
import { CreditCard, Link2, Plus, Trash2, Trophy } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, Tag } from "@/components/ui/panel"
import { sourceMeta, winValue } from "@/lib/wins"
import { SelectMenu } from "@/components/ui/select-menu"

/**
 * The two "things you tell us" panels on the profile.
 *
 * Both talk to /api/profile/* rather than the browser Supabase client. Payout
 * details live behind RLS with no policy at all, and site usernames carry
 * `auth.uid() = user_id` policies that can never match a site authenticated by
 * a Kick cookie — so in both cases the route is what establishes who is asking.
 */

const PAYMENT_OPTIONS = [
  { id: "paypal", name: "PayPal", placeholder: "you@example.com", hint: "" },
  { id: "crypto", name: "Crypto", placeholder: "Wallet address", hint: "Network" },
  { id: "bank", name: "Bank", placeholder: "IBAN or account number", hint: "Bank name" },
  { id: "skrill", name: "Skrill", placeholder: "you@example.com", hint: "" },
  { id: "other", name: "Other", placeholder: "Account", hint: "What it is" },
]

const fieldClass =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor}>
        <MonoLabel className="mb-1.5 block text-white/30">{label}</MonoLabel>
      </label>
      {children}
    </div>
  )
}

function AddButton({ busy, children, accent }: { busy: boolean; children: React.ReactNode; accent: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
      style={{ backgroundColor: accent }}
    >
      <Plus className="h-3.5 w-3.5" />
      {busy ? "Saving…" : children}
    </button>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8">
      {icon}
      <p className="text-[13px] text-white/30">{text}</p>
    </div>
  )
}

type Account = { id: string; site_name: string; username: string }

export function ConnectedAccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [site, setSite] = useState("")
  const [username, setUsername] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch("/api/profile/site-usernames", { cache: "no-store" })
    if (!response.ok) return
    const payload = await response.json()
    setAccounts((payload.accounts ?? []) as Account[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!site.trim() || !username.trim()) return
    setBusy(true)
    setError(null)
    const response = await fetch("/api/profile/site-usernames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_name: site, username }),
    })
    const payload = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok) {
      setError(payload?.error ?? "Could not save that username")
      return
    }
    setSite("")
    setUsername("")
    await load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/profile/site-usernames?id=${id}`, { method: "DELETE" })
    if (!response.ok) {
      setError("Could not remove that username")
      return
    }
    setAccounts((current) => current.filter((entry) => entry.id !== id))
  }

  return (
    <Panel accent="blue">
      <PanelHeader
        title="Casino accounts"
        right={<MonoLabel className="text-white/25">{accounts.length}</MonoLabel>}
      />
      <form onSubmit={add} className="space-y-3 border-b border-white/[0.05] p-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Site" htmlFor="site">
            <input
              id="site"
              value={site}
              onChange={(event) => setSite(event.target.value)}
              placeholder="Stake, Roobet…"
              className={fieldClass}
            />
          </Field>
          <Field label="Your username there" htmlFor="site-username">
            <input
              id="site-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className={fieldClass}
            />
          </Field>
        </div>
        {error && (
          <p className="text-[12px]" style={{ color: ACCENTS.red }}>
            {error}
          </p>
        )}
        <AddButton busy={busy} accent={ACCENTS.blue}>
          Add account
        </AddButton>
      </form>

      {accounts.length === 0 ? (
        <Empty icon={<Link2 className="h-6 w-6 text-white/10" />} text="No accounts linked yet." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">{account.username}</p>
                <MonoLabel className="text-white/30">{account.site_name}</MonoLabel>
              </div>
              <button
                type="button"
                onClick={() => remove(account.id)}
                aria-label={`Remove ${account.site_name}`}
                className="shrink-0 rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

type Payment = { id: string; method: string; label: string | null; value: string; is_primary: boolean }

export function PaymentMethodsPanel() {
  const [methods, setMethods] = useState<Payment[]>([])
  const [method, setMethod] = useState("paypal")
  const [value, setValue] = useState("")
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = PAYMENT_OPTIONS.find((option) => option.id === method) ?? PAYMENT_OPTIONS[0]

  const load = useCallback(async () => {
    const response = await fetch("/api/profile/payment-methods", { cache: "no-store" })
    if (!response.ok) return
    const payload = await response.json()
    setMethods((payload.methods ?? []) as Payment[])
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
    <Panel accent="green">
      <PanelHeader
        title="Payout details"
        accent="green"
        right={<MonoLabel className="text-white/25">{methods.length}</MonoLabel>}
      />
      <form onSubmit={add} className="space-y-3 border-b border-white/[0.05] p-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Method" htmlFor="pm-method">
            <SelectMenu
              id="pm-method"
              aria-label="Payment method"
              value={method}
              onChange={(value) => {
                setMethod(value)
                setLabel("")
              }}
              options={PAYMENT_OPTIONS.map((option) => ({ value: option.id, label: option.name }))}
            />
          </Field>
          {chosen.hint ? (
            <Field label={chosen.hint} htmlFor="pm-label">
              <input
                id="pm-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={chosen.hint === "Network" ? "BTC, LTC…" : ""}
                className={fieldClass}
              />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        <Field label="Details" htmlFor="pm-value">
          <input
            id="pm-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={chosen.placeholder}
            className={fieldClass}
          />
        </Field>

        {error && (
          <p className="text-[12px]" style={{ color: ACCENTS.red }}>
            {error}
          </p>
        )}
        <AddButton busy={busy} accent={ACCENTS.green}>
          Add payout method
        </AddButton>
      </form>

      {methods.length === 0 ? (
        <Empty icon={<CreditCard className="h-6 w-6 text-white/10" />} text="No payout details saved." />
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {methods.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <MonoLabel style={{ color: ACCENTS.green }}>{entry.method}</MonoLabel>
                  {entry.label && <span className="text-[11px] text-white/30">{entry.label}</span>}
                  {entry.is_primary && <Tag accent="blue">Primary</Tag>}
                </div>
                <p className="mt-0.5 truncate font-mono text-[12px] text-white/60">{entry.value}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label={`Remove ${entry.method}`}
                className="shrink-0 rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-white/[0.05] px-3.5 py-2 text-[11px] text-white/25">
        Only you and the admin can see these — they are not readable from the site itself.
      </p>
    </Panel>
  )
}

type Win = {
  id: string
  source: string
  source_ref: string | null
  prize: string
  amount: number | null
  points: number | null
  status: string
  created_at: string
}

/**
 * The player's own wins.
 *
 * Matched on their username as well as their account id, so a giveaway won
 * before they ever signed in still shows up here.
 */
export function MyWinsPanel() {
  const [wins, setWins] = useState<Win[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const response = await fetch("/api/profile/wins", { cache: "no-store" })
      if (!response.ok) {
        if (!cancelled) setLoaded(true)
        return
      }
      const payload = await response.json()
      if (cancelled) return
      setWins((payload.wins ?? []) as Win[])
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Hidden entirely until there is something to show — an empty trophy case on
  // every profile is just noise.
  if (!loaded || wins.length === 0) return null

  return (
    <Panel accent="purple">
      <PanelHeader
        title="Your wins"
        accent="purple"
        right={<MonoLabel className="text-white/25">{wins.length}</MonoLabel>}
      />
      <ul className="divide-y divide-white/[0.05]">
        {wins.map((win) => {
          const meta = sourceMeta(win.source)
          return (
            <li key={win.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.amber }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-white">{win.prize}</p>
                <p className="truncate text-[11px] text-white/30">
                  {[meta.label, win.source_ref].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Tag accent={win.status === "paid" ? "green" : "amber"}>
                {win.status === "paid" ? "Paid out" : "On the way"}
              </Tag>
              <span className="w-24 shrink-0 text-right text-[13px] tabular-nums" style={{ color: ACCENTS.green }}>
                {winValue(win)}
              </span>
              <MonoLabel className="w-20 shrink-0 text-right text-white/20">
                {new Date(win.created_at).toLocaleDateString()}
              </MonoLabel>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
