"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Gamepad2, Plus } from "lucide-react"

type Slot = {
  id: string
  game_name: string
  provider: string
}

export default function SlotsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState<Slot[]>([])
  const [newSlotName, setNewSlotName] = useState("")
  const [newSlotProvider, setNewSlotProvider] = useState("")
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
        .order("provider", { ascending: true })
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

    console.log(`[v0] Fetched ${allSlots.length} total slots`)
    setSlots(allSlots)
  }

  async function fetchSlots() {
    await fetchAllSlots()
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault()

    if (!newSlotName || !newSlotProvider) {
      toast({
        title: "Error",
        description: "Please enter both slot name and provider",
        variant: "destructive",
      })
      return
    }

    const { error } = await supabase.from("slots").insert([
      {
        game_name: newSlotName,
        provider: newSlotProvider,
      },
    ])

    if (error) {
      console.error("Error adding slot:", error)
      toast({
        title: "Error",
        description: "Failed to add slot",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Slot added successfully",
        className: "bg-green-600 text-white",
      })
      setNewSlotName("")
      setNewSlotProvider("")
      fetchSlots()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-white text-xs">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="mt-3">
        <Card className="bg-white/[0.022] backdrop-blur border-white/[0.08]">
          <CardHeader className="p-3">
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Gamepad2 className="w-4 h-4" />
              Edit Slots Database
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <form onSubmit={handleAddSlot} className="space-y-2 mb-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="new_slot_name" className="text-white/60 text-xs">
                    Slot Name
                  </Label>
                  <Input
                    id="new_slot_name"
                    value={newSlotName}
                    onChange={(e) => setNewSlotName(e.target.value)}
                    className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                    placeholder="Enter slot name"
                  />
                </div>
                <div>
                  <Label htmlFor="new_slot_provider" className="text-white/60 text-xs">
                    Provider
                  </Label>
                  <Input
                    id="new_slot_provider"
                    value={newSlotProvider}
                    onChange={(e) => setNewSlotProvider(e.target.value)}
                    className="bg-[#101014] border-white/[0.10] text-white h-8 text-xs"
                    placeholder="Enter provider"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-[#5B8DEF] hover:bg-[#4A7AD8] flex items-center gap-2 h-8 text-xs"
              >
                <Plus className="w-3 h-3" />
                Add Slot to Database
              </Button>
            </form>

            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 font-semibold text-white/60 pb-2 border-b border-white/[0.10] sticky top-0 bg-white/[0.022] backdrop-blur text-xs">
                <div>Slot</div>
                <div>Provider</div>
              </div>
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="grid grid-cols-2 gap-4 text-white py-2 border-b border-white/[0.08] hover:bg-[#101014]/30 transition-colors text-xs"
                >
                  <div>{slot.game_name}</div>
                  <div className="text-white/40">{slot.provider}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
