"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Sparkles, Ticket, Users } from "lucide-react"

interface Raffle {
  id: string
  title: string
  description: string
  prize_name: string
  prize_value: number
  ticket_price: number
  tickets_sold: number
  status: string
  winner_username: string
  winner_ticket_number: number
  draw_date: string
}

export default function RaffleHistoryPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchRaffles()
  }, [])

  async function fetchRaffles() {
    setLoading(true)
    const { data, error } = await supabase
      .from("raffles")
      .select("*")
      .eq("status", "drawn")
      .order("draw_date", { ascending: false })

    if (error) {
      console.error("Error fetching raffles:", error)
    } else {
      setRaffles(data || [])
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Raffle History</h1>
          <p className="text-slate-400 mt-1">View all drawn raffles and their winners</p>
        </div>

        {loading ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-8 text-center text-slate-400">Loading history...</CardContent>
          </Card>
        ) : raffles.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-8 text-center text-slate-400">No drawn raffles yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {raffles.map((raffle) => (
              <Card key={raffle.id} className="border-slate-700 bg-slate-800/50">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-bold text-white">{raffle.title}</h3>
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Drawn</Badge>
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
                      {raffle.winner_username && (
                        <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span className="text-white font-medium">Winner: {raffle.winner_username}</span>
                          <span className="text-slate-400 text-sm">Ticket #{raffle.winner_ticket_number}</span>
                        </div>
                      )}
                    </div>
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
