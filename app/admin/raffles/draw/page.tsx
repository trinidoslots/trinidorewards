"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Trophy, Ticket, Users } from "lucide-react"
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
}

export default function DrawRafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchRaffles()
  }, [])

  async function fetchRaffles() {
    setLoading(true)
    const { data, error } = await supabase
      .from("raffles")
      .select("*")
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

  async function handleDrawWinner(raffle: Raffle) {
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
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Draw Raffles</h1>
          <p className="text-slate-400 mt-1">Draw winners for ended raffles</p>
        </div>

        {loading ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-8 text-center text-slate-400">Loading raffles...</CardContent>
          </Card>
        ) : raffles.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-8 text-center text-slate-400">
              No raffles ready to draw. All ended raffles have been drawn!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {raffles.map((raffle) => (
              <Card
                key={raffle.id}
                className="border-slate-700 bg-slate-800/50 hover:border-amber-500/50 transition-all cursor-pointer"
                onClick={() => handleDrawWinner(raffle)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-bold text-white">{raffle.title}</h3>
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Ready to Draw</Badge>
                      </div>
                      <p className="text-slate-400">{raffle.description}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-cyan-400" />
                          <span className="text-slate-300">{raffle.ticket_price} pts/ticket</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span className="text-slate-300">Total Tickets: {raffle.tickets_sold}</span>
                        </div>
                        {raffle.prize_value && (
                          <div className="text-green-400 font-medium">${raffle.prize_value.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDrawWinner(raffle)
                      }}
                      disabled={isDrawing}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      Draw Winner
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
