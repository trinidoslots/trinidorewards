"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Shuffle } from "lucide-react"

type Slot = {
  id: string
  game_name: string
  provider: string
}

export default function RandomSlotPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState<Slot[]>([])
  const [randomSlot, setRandomSlot] = useState<Slot | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
    } else {
      setUser(user)
      await fetchSlots()
      setLoading(false)
    }
  }

  async function fetchAllSlots() {
    let allSlots: Slot[] = []
    let from = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from("slots")
        .select("*")
        .range(from, from + batchSize - 1)

      if (error) {
        console.error("[v0] Error fetching slots:", error)
        break
      }

      if (data) {
        allSlots = allSlots.concat(data)

        // If we got fewer rows than the batch size, we've reached the end
        if (data.length < batchSize) {
          hasMore = false
        } else {
          from += batchSize
        }
      } else {
        hasMore = false
      }
    }

    console.log(`[v0] Fetched ${allSlots.length} total slots for random selection`)
    setSlots(allSlots)
  }

  async function fetchSlots() {
    await fetchAllSlots()
  }

  function handleRandomize() {
    if (slots.length === 0) {
      toast({
        title: "Error",
        description: "No slots available",
        variant: "destructive",
      })
      return
    }

    setIsSpinning(true)

    // Simulate spinning animation
    let count = 0
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * slots.length)
      setRandomSlot(slots[randomIndex])
      count++

      if (count > 20) {
        clearInterval(interval)
        setIsSpinning(false)
      }
    }, 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-white text-xs">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto">
        <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
          <CardHeader className="p-3">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Shuffle className="w-4 h-4" />
              Random Slot Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-4">
            <div className="text-center">
              <p className="text-slate-400 mb-3 text-xs">Generate a random slot from your database</p>
              <Button
                onClick={handleRandomize}
                disabled={isSpinning || slots.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-sm px-6 py-4 h-auto"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                {isSpinning ? "Spinning..." : "Generate Random Slot"}
              </Button>
            </div>

            {randomSlot && (
              <div className="mt-6 p-6 bg-gradient-to-br from-purple-900/30 to-amber-900/30 rounded-lg border-2 border-purple-500/50">
                <div className="text-center">
                  <p className="text-slate-400 text-xs mb-2">Selected Slot</p>
                  <h2 className="text-2xl font-bold text-white mb-2">{randomSlot.game_name}</h2>
                  <p className="text-amber-400 text-sm">{randomSlot.provider}</p>
                </div>
              </div>
            )}

            <div className="text-center text-[10px] text-slate-400">Total slots in database: {slots.length}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
