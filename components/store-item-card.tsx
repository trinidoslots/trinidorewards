"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

type StoreItem = {
  id: string
  name: string
  description: string | null
  cost: number
  icon: string | null
  category: string | null
  quantity: number
  is_available: string
}

export function StoreItemCard({
  item,
  userPoints,
  isLoggedIn,
}: {
  item: StoreItem
  userPoints: number
  isLoggedIn: boolean
}) {
  const [purchasing, setPurchasing] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const canAfford = userPoints >= item.cost
  const inStock = item.quantity > 0

  async function handlePurchase() {
    if (!isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please log in to purchase items",
        variant: "destructive",
      })
      return
    }

    if (!canAfford) {
      toast({
        title: "Insufficient Points",
        description: `You need ${item.cost - userPoints} more points`,
        variant: "destructive",
      })
      return
    }

    setPurchasing(true)

    try {
      const response = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Purchase Successful!",
          description: `You bought ${item.name}. New balance: ${data.newBalance} points`,
          className: "bg-green-600 text-white",
        })
        router.refresh()
      } else {
        toast({
          title: "Purchase Failed",
          description: data.error || "Something went wrong",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete purchase",
        variant: "destructive",
      })
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur hover:border-cyan-500/50 transition-colors">
      <CardContent className="p-3">
        {item.icon && (
          <div className="relative w-full h-40 mb-3 rounded-lg overflow-hidden bg-slate-800">
            <Image src={item.icon || "/placeholder.svg"} alt={item.name} fill className="object-cover" />
          </div>
        )}
        <h3 className="text-white text-sm font-semibold mb-1">{item.name}</h3>
        {item.description && <p className="text-slate-400 text-xs mb-2 line-clamp-2">{item.description}</p>}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <span className="text-amber-400 text-lg">🪙</span>
            <span className="text-amber-400 text-lg font-bold">{item.cost.toLocaleString()}</span>
          </div>
          {inStock ? (
            <span className="text-green-400 text-xs">In Stock ({item.quantity})</span>
          ) : (
            <span className="text-red-400 text-xs">Out of Stock</span>
          )}
        </div>
        <Button
          onClick={handlePurchase}
          disabled={!isLoggedIn || !canAfford || !inStock || purchasing}
          className="w-full h-8 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-3 h-3 mr-1" />
          {purchasing
            ? "Processing..."
            : !isLoggedIn
              ? "Login to Buy"
              : !canAfford
                ? "Not Enough Points"
                : !inStock
                  ? "Out of Stock"
                  : "Purchase"}
        </Button>
      </CardContent>
    </Card>
  )
}
