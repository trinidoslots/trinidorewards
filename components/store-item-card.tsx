"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Package, ShoppingCart } from "lucide-react"
import { ACCENTS, type Accent } from "@/components/ui/panel"
import { ArtImage } from "@/components/art-image"
import { inStock, isUnlimited, stockLabel, type StoreItem } from "@/lib/store"
import { StoreBuyDialog } from "@/components/store-buy-dialog"
import type { PayoutDetails } from "@/lib/payout"

/**
 * One item in the store.
 *
 * The affordability and stock states are all stated on the button itself rather
 * than only surfacing as a toast after a failed click — you should be able to
 * see what you can buy without trying.
 */
export function StoreItemCard({
  item,
  userPoints,
  isLoggedIn,
  isCodeUser = false,
}: {
  item: StoreItem
  userPoints: number
  isLoggedIn: boolean
  /** The Code User rank. A Code-User-only item is shown to everyone, locked for the rest. */
  isCodeUser?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const cost = Number(item.cost) || 0
  const canAfford = userPoints >= cost
  const available = inStock(item)
  const short = cost - userPoints
  // Shown rather than hidden, as a reason to use the code. The purchase route
  // refuses it regardless of what this says.
  const locked = item.code_user_only === true && !isCodeUser

  async function buy(payout: PayoutDetails | null) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, payout }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        // Kept open so whatever was typed is still there to correct — closing
        // on a rejected address would mean entering the whole thing again.
        setMessage({ tone: "error", text: data?.error ?? "Could not complete that purchase" })
        return
      }
      setPreviewing(false)
      setMessage({ tone: "ok", text: "Bought — check your profile for the status." })
      router.refresh()
    } catch (error) {
      console.error("[v0] Purchase error:", error)
      setMessage({ tone: "error", text: "Could not reach the server" })
    } finally {
      setBusy(false)
    }
  }

  const buyable = isLoggedIn && !locked && available && canAfford
  // How close your balance is to the price, for the bar under it.
  const progress = cost > 0 ? Math.min(100, (userPoints / cost) * 100) : 100

  return (
    // The wrapper is what the card measures its corners against: 3.2% of its
    // width, the artwork's own corner radius (components/art-image.tsx).
    <div className="@container flex">
      <div className="relative flex w-full flex-col overflow-hidden rounded-[3.2cqw] border border-white/[0.08] bg-[#0E0E12] transition duration-300 hover:-translate-y-1 hover:border-white/20">
        <ArtImage src={item.icon || null} icon={Package} />

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex flex-wrap gap-1.5">
            <Chip accent={isUnlimited(item.quantity) ? "blue" : available ? "green" : "red"}>
              {stockLabel(Number(item.quantity))}
            </Chip>
            {item.code_user_only && (
              <Chip accent="purple">
                <Lock className="h-2.5 w-2.5" /> Code Users
              </Chip>
            )}
          </div>

          <div>
            <h3 className="truncate text-[17px] font-bold text-white">{item.name}</h3>
            {item.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/45">{item.description}</p>}
          </div>

          <div className="mt-auto space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[22px] font-black tabular-nums text-white">
                {cost.toLocaleString("en-US")} <span className="text-[13px] font-semibold text-white/45">pts</span>
              </span>
              {isLoggedIn && !locked && available && (
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: canAfford ? ACCENTS.green : "rgba(255,255,255,0.45)" }}>
                  {canAfford ? "You can afford it" : `${short.toLocaleString("en-US")} short`}
                </span>
              )}
            </div>

            {isLoggedIn && !locked && available && (
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, backgroundColor: canAfford ? ACCENTS.green : ACCENTS.pink }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setPreviewing(true)}
              disabled={busy || !buyable}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-[14px] font-bold transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
              style={
                locked
                  ? { border: `1px solid ${ACCENTS.purple}55`, backgroundColor: `${ACCENTS.purple}14`, color: ACCENTS.purple }
                  : buyable
                    ? { backgroundColor: ACCENTS.green, color: "#000", boxShadow: `0 10px 30px -14px ${ACCENTS.green}` }
                    : { border: "1px solid rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }
              }
            >
              {locked ? <Lock className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {busy
                ? "Buying…"
                : locked
                  ? "Code Users only"
                  : !isLoggedIn
                    ? "Sign in to buy"
                    : !available
                      ? "Out of stock"
                      : !canAfford
                        ? `${short.toLocaleString("en-US")} points short`
                        : "Buy"}
            </button>

            {message && !previewing && (
              <p className="text-center text-[13px]" style={{ color: message.tone === "ok" ? ACCENTS.green : ACCENTS.red }}>
                {message.text}
              </p>
            )}
          </div>
        </div>

        {previewing && (
          <StoreBuyDialog
            item={item}
            userPoints={userPoints}
            busy={busy}
            error={message?.tone === "error" ? message.text : null}
            onClose={() => {
              setPreviewing(false)
              setMessage(null)
            }}
            onConfirm={buy}
          />
        )}
      </div>
    </div>
  )
}

function Chip({ children, accent }: { children: React.ReactNode; accent: Accent }) {
  const color = ACCENTS[accent]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}26`, color }}
    >
      {children}
    </span>
  )
}
