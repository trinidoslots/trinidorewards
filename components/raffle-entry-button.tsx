"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Gift } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface RaffleEntryButtonProps {
  raffleId: string
  isFree: boolean
  ticketPrice: number
}

export default function RaffleEntryButton({ raffleId, isFree, ticketPrice }: RaffleEntryButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  async function handleEnter() {
    setLoading(true)
    try {
      const response = await fetch("/api/raffles/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raffleId }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success!",
          description: "You have successfully entered the raffle!",
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to enter raffle",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error entering raffle:", error)
      toast({
        title: "Error",
        description: "Failed to enter raffle",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleEnter} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white">
      <Gift className="w-4 h-4 mr-2" />
      {loading ? "Entering..." : isFree ? "Enter Free" : `Enter Raffle (${ticketPrice} Points)`}
    </Button>
  )
}
