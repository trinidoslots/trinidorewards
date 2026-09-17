"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Trophy, Ticket, Users, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface Raffle {
  id: string
  title: string
  description: string
  prize_name: string
  prize_value: number
  ticket_price: number
  tickets_sold: number
  status: string
  end_date: string
  raffle_entries?: Array<{ tickets_purchased: number }>
}

export default function DrawRafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchRaffles()
  }, [])

  async function fetchRaffles() {
    setLoading(true)
    const { data, error } = await supabase
      .from("raffles")
      .select("*, raffle_entries(tickets_purchased)")
      .eq("status", "ended")
      .is("winner_username", null)
      .order("end_date", { ascending: false })

    if (error) {
      console.error("Error fetching raffles:", error)
    } else {
      setRaffles(data || [])
    }
    setLoading(false)
  }

  function getTotalEntries(raffle: Raffle): number {
    if (!raffle.raffle_entries || raffle.raffle_entries.length === 0) {
      return 0
    }
    return raffle.raffle_entries.reduce((sum, entry) => sum + (entry.tickets_purchased || 0), 0)
  }

  async function handleDeleteRaffle(raffle: Raffle) {
    const totalEntries = getTotalEntries(raffle)

    if (!confirm(`Are you sure you want to delete "${raffle.title}"? This cannot be undone.`)) {
      return
    }

    setDeletingId(raffle.id)

    try {
      const response = await fetch("/api/raffles/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ raffleId: raffle.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete raffle")
      }

      alert("Raffle deleted successfully!")
      fetchRaffles()
    } catch (err) {
      console.error("Error deleting raffle:", err)
      alert("Failed to delete raffle: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDrawWinner(raffle: Raffle) {
    const totalEntries = getTotalEntries(raffle)

    if (totalEntries === 0) {
      alert("This raffle has no entries. Please delete it instead of drawing a winner.")
      return
    }

    if (!confirm(`Are you sure you want to draw a winner for "${raffle.title}"? This cannot be undone.`)) return

    setIsDrawing(true)

    try {
      const { data, error } = await supabase.rpc("draw_raffle_winner", {
        raffle_id_param: raffle.id,
      })

      if (error) {
        console.error("Error drawing winner:", error)
        alert("Failed to draw winner: " + error.message)
      } else if (data && data.length > 0) {
        const result = data[0]
        if (result.winner_username) {
          alert(
            `Winner drawn!\n\nWinner: ${result.winner_username}\nTicket #${result.winner_ticket_number}\nTotal Entries: ${result.total_entries}`,
          )
          fetchRaffles()
        } else {
          alert("No entries found for this raffle. Cannot draw a winner.")
        }
      }
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred while drawing the winner")
    } finally {
      setIsDrawing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Draw Raffles</h1>
          <p className="text-white/40 mt-1">Draw winners for ended raffles</p>
        </div>

        {loading ? (
          <Card className="border-white/[0.10] bg-white/[0.04]">
            <CardContent className="py-8 text-center text-white/40">Loading raffles...</CardContent>
          </Card>
        ) : raffles.length === 0 ? (
          <Card className="border-white/[0.10] bg-white/[0.04]">
            <CardContent className="py-8 text-center text-white/40">
              No raffles ready to draw. All ended raffles have been drawn!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {raffles.map((raffle) => {
              const totalEntries = getTotalEntries(raffle)
              const hasEntries = totalEntries > 0

              return (
                <Card
                  key={raffle.id}
                  className="border-white/[0.10] bg-white/[0.04] hover:border-amber-500/50 transition-all"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <h3 className="text-lg font-bold text-white">{raffle.title}</h3>
                          {hasEntries ? (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                              Ready to Draw
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">No Entries</Badge>
                          )}
                        </div>
                        <p className="text-white/40">{raffle.description}</p>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-[#5B8DEF]" />
                            <span className="text-white/60">{raffle.ticket_price} pts/ticket</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-400" />
                            <span className="text-white/60">Total Tickets: {totalEntries}</span>
                          </div>
                          {raffle.prize_value && (
                            <div className="text-green-400 font-medium">${raffle.prize_value.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {hasEntries ? (
                          <Button
                            size="sm"
                            onClick={() => handleDrawWinner(raffle)}
                            disabled={isDrawing}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            Draw Winner
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteRaffle(raffle)}
                            disabled={deletingId === raffle.id}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            {deletingId === raffle.id ? "Deleting..." : "Delete"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
