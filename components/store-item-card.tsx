"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Package, ShoppingCart } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, Tag } from "@/components/ui/panel"
import { inStock, isUnlimited, stockLabel, type StoreItem } from "@/lib/store"

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
}: {
  item: StoreItem
  userPoints: number
  isLoggedIn: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const cost = Number(item.cost) || 0
  const canAfford = userPoints >= cost
  const available = inStock(item)
  const short = cost - userPoints

  async function buy() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setMessage({ tone: "error", text: data?.error ?? "Could not complete that purchase" })
        return
      }
      setMessage({ tone: "ok", text: "Bought — check your profile for the status." })
      router.refresh()
    } catch (error) {
      console.error("[v0] Purchase error:", error)
      setMessage({ tone: "error", text: "Could not reach the server" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel accent={available ? "blue" : "slate"} className="lift flex h-full flex-col overflow-hidden">
      {item.icon ? (
        <img src={item.icon} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-white/[0.02]">
          <Package className="h-9 w-9 text-white/10" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold text-white">{item.name}</h3>
            {item.category && <MonoLabel className="text-white/25">{item.category}</MonoLabel>}
          </div>
          <Tag accent={isUnlimited(item.quantity) ? "blue" : available ? "green" : "red"}>
            {stockLabel(Number(item.quantity))}
          </Tag>
        </div>

        {item.description && <p className="line-clamp-2 text-[12px] text-white/35">{item.description}</p>}

        <div className="mt-auto space-y-2 border-t border-white/[0.06] pt-2.5">
          <div className="flex items-baseline justify-between">
            <MonoLabel className="text-white/25">Price</MonoLabel>
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: ACCENTS.blue }}>
              {cost.toLocaleString()} pts
            </span>
          </div>

          <button
            type="button"
            onClick={buy}
            disabled={busy || !isLoggedIn || !available || !canAfford}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] transition disabled:cursor-not-allowed"
            style={
              isLoggedIn && available && canAfford
                ? { backgroundColor: ACCENTS.blue, color: "#0B0B0D" }
                : { border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
            }
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {busy
              ? "Buying…"
              : !isLoggedIn
                ? "Sign in to buy"
                : !available
                  ? "Out of stock"
                  : !canAfford
                    ? `${short.toLocaleString()} points short`
                    : "Buy"}
          </button>

          {message && (
            <p
              className="text-center text-[12px]"
              style={{ color: message.tone === "ok" ? ACCENTS.green : ACCENTS.red }}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}
