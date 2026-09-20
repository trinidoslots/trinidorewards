"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, Package, ShoppingCart, X } from "lucide-react"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import {
  CRYPTOS,
  chainsFor,
  checkAddress,
  checkUsername,
  defaultChainFor,
  needsChain,
  payoutMethodLabel,
  type PayoutDetails,
  type PayoutMethod,
} from "@/lib/payout"
import type { StoreItem } from "@/lib/store"

/**
 * The preview that opens on Buy.
 *
 * Two steps on purpose. The first shows what is being bought and collects where
 * it should be sent; the second is a plain "is this right" with the details
 * repeated back, because the thing being confirmed is a wallet address — the
 * one field where a typo cannot be undone afterwards.
 */

const money = (value: number) => value.toLocaleString("en-US")

export function StoreBuyDialog({
  item,
  userPoints,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  item: StoreItem
  userPoints: number
  busy: boolean
  /** A rejection from the server, shown here so the typed details survive it. */
  error: string | null
  onClose: () => void
  onConfirm: (details: PayoutDetails | null) => void
}) {
  const method = (item.payout_method === "onsite_tip" || item.payout_method === "crypto"
    ? item.payout_method
    : null) as PayoutMethod | null

  const [step, setStep] = useState<"details" | "confirm">("details")
  const [username, setUsername] = useState("")
  const [crypto, setCrypto] = useState(CRYPTOS[0].code)
  const [chain, setChain] = useState<string>(defaultChainFor(CRYPTOS[0].code)?.id ?? "")
  const [address, setAddress] = useState("")

  const chains = chainsFor(crypto)
  const chainNeeded = needsChain(crypto)

  // Changing coin has to reset the network: USDT on Tron is not a sensible
  // default to carry over to a coin that has never heard of Tron.
  useEffect(() => {
    setChain(defaultChainFor(crypto)?.id ?? "")
  }, [crypto])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !busy && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, busy])

  const cost = Number(item.cost) || 0

  const { details, problem, warning } = useMemo((): {
    details: PayoutDetails | null
    problem: string | null
    warning: string | null
  } => {
    if (method === null) return { details: null, problem: null, warning: null }

    if (method === "onsite_tip") {
      const check = checkUsername(username)
      if (!check.ok) return { details: null, problem: check.warning ?? null, warning: null }
      return { details: { method: "onsite_tip", username: username.trim() }, problem: null, warning: null }
    }

    if (chainNeeded && !chain) return { details: null, problem: `Pick a network for ${crypto}`, warning: null }

    const resolved = chain || defaultChainFor(crypto)?.id || ""
    const check = checkAddress(crypto, resolved, address)
    if (!check.ok) return { details: null, problem: check.warning ?? null, warning: null }

    return {
      details: { method: "crypto", crypto, chain: resolved, address: address.trim() },
      problem: null,
      // Present but not blocking: the address simply does not look like this
      // network's. See checkAddress.
      warning: check.warning ?? null,
    }
  }, [method, username, crypto, chain, address, chainNeeded])

  const ready = method === null || details !== null

  // Mounted into document.body rather than left where it is written.
  //
  // The card it opens from is a Panel with the `lift` class, which sets a
  // transform. Any transform other than `none` makes that element the
  // containing block for position:fixed descendants, so the overlay sized
  // itself to the card — measured at 291x366 inside a 1200x900 window, with the
  // dialog crammed into one column of the grid instead of covering the screen.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-label={`Buy ${item.name}`}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-xl border border-white/[0.10] bg-[#0E0E11]"
      >
        <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <MonoLabel className="text-white/70">{step === "details" ? "Buy" : "Confirm"}</MonoLabel>
          <span className="truncate text-[13px] text-white/40">{item.name}</span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="ml-auto rounded p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {/* The preview: what is actually being bought. */}
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/30">
            {item.icon ? (
              // eslint-disable-next-line @next/next/no-img-element -- stored as a plain path
              <img src={item.icon} alt="" className="aspect-[8/5] w-full object-contain" />
            ) : (
              <div className="flex aspect-[8/5] w-full items-center justify-center">
                <Package className="h-8 w-8 text-white/10" />
              </div>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <MonoLabel className="text-white/30">Price</MonoLabel>
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: ACCENTS.blue }}>
              {money(cost)} pts
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-white/[0.06] pt-2">
            <MonoLabel className="text-white/30">Balance after</MonoLabel>
            <span className="text-[13px] tabular-nums text-white/60">{money(userPoints - cost)} pts</span>
          </div>

          {step === "details" ? (
            <Fields
              method={method}
              username={username}
              setUsername={setUsername}
              crypto={crypto}
              setCrypto={setCrypto}
              chain={chain}
              setChain={setChain}
              chains={chains}
              chainNeeded={chainNeeded}
              address={address}
              setAddress={setAddress}
            />
          ) : (
            <Summary details={details} />
          )}

          {problem && step === "details" && <Note tone="muted">{problem}</Note>}
          {warning && <Note tone="warn">{warning}</Note>}
          {error && <Note tone="error">{error}</Note>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
          <button
            type="button"
            onClick={() => (step === "confirm" ? setStep("details") : onClose())}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-30"
          >
            {step === "confirm" ? "Back" : "Cancel"}
          </button>

          {step === "details" ? (
            <button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={!ready}
              className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-30"
              style={{ backgroundColor: ACCENTS.blue }}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Buy
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onConfirm(details)}
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.green }}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {busy ? "Buying…" : "Confirm to Buy"}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function Note({ tone, children }: { tone: "warn" | "muted" | "error"; children: React.ReactNode }) {
  const color = tone === "warn" ? ACCENTS.amber : tone === "error" ? ACCENTS.red : "rgba(255,255,255,0.35)"
  return (
    <p className="flex items-start gap-2 text-[12px] leading-relaxed" style={{ color }}>
      {tone !== "muted" && <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}

const FIELD =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition focus:border-white/25"

function Fields({
  method,
  username,
  setUsername,
  crypto,
  setCrypto,
  chain,
  setChain,
  chains,
  chainNeeded,
  address,
  setAddress,
}: {
  method: PayoutMethod | null
  username: string
  setUsername: (value: string) => void
  crypto: string
  setCrypto: (value: string) => void
  chain: string
  setChain: (value: string) => void
  chains: { id: string; label: string }[]
  chainNeeded: boolean
  address: string
  setAddress: (value: string) => void
}) {
  if (method === null) {
    return <Note tone="muted">Nothing else is needed — the details are arranged with you afterwards.</Note>
  }

  return (
    <div className="space-y-3 border-t border-white/[0.06] pt-3">
      <MonoLabel className="block text-white/30">{payoutMethodLabel(method)}</MonoLabel>

      {method === "onsite_tip" ? (
        <div>
          <MonoLabel className="mb-1.5 block text-white/30">Username</MonoLabel>
          <input
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Your casino username"
            className={FIELD}
          />
        </div>
      ) : (
        <>
          <div className={chainNeeded ? "grid grid-cols-2 gap-3" : undefined}>
            <div>
              <MonoLabel className="mb-1.5 block text-white/30">Coin</MonoLabel>
              <select value={crypto} onChange={(event) => setCrypto(event.target.value)} className={FIELD}>
                {CRYPTOS.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code} — {entry.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Only for coins that actually live on more than one network. */}
            {chainNeeded && (
              <div>
                <MonoLabel className="mb-1.5 block text-white/30">Network</MonoLabel>
                <select value={chain} onChange={(event) => setChain(event.target.value)} className={FIELD}>
                  <option value="">Choose…</option>
                  {chains.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <MonoLabel className="mb-1.5 block text-white/30">Wallet address</MonoLabel>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder={`Your ${crypto} address`}
              className={`${FIELD} font-mono text-[12px]`}
            />
          </div>
        </>
      )}
    </div>
  )
}

/** The details read back before the irreversible half. */
function Summary({ details }: { details: PayoutDetails | null }) {
  if (!details) return <Note tone="muted">Nothing else is needed.</Note>

  const rows =
    details.method === "onsite_tip"
      ? [{ label: "Tip to", value: details.username, mono: false }]
      : [
          { label: "Coin", value: details.crypto, mono: false },
          { label: "Network", value: chainsFor(details.crypto).find((c) => c.id === details.chain)?.label ?? details.chain, mono: false },
          { label: "Wallet", value: details.address, mono: true },
        ]

  return (
    <div className="space-y-2 border-t border-white/[0.06] pt-3">
      {rows.map((row) => (
        <div key={row.label}>
          <MonoLabel className="mb-1 block text-white/30">{row.label}</MonoLabel>
          <p
            className={`break-all text-[13px] text-white/80 ${row.mono ? "font-mono text-[12px]" : ""}`}
          >
            {row.value}
          </p>
        </div>
      ))}
      <Note tone="muted">Check this carefully — a payout cannot be pulled back once it has been sent.</Note>
    </div>
  )
}
