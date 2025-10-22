"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Trophy, Ticket, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Raffle {
  id: string
  title: string
  description: string
  prize_name: string
  prize_value: number
  ticket_price: number
  tickets_sold: number
  total_tickets_available: number
  status: string
  featured: boolean
  start_date: string
  end_date: string
}

export default function ActiveRafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [loading, setLoading] = useState(true)
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
      .eq("status", "active")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching raffles:", error)
    } else {
      setRaffles(data || [])
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this raffle?")) return

    const { error } = await supabase.from("raffles").delete().eq("id", id)

    if (error) {
      console.error("Error deleting raffle:", error)
      alert("Failed to delete raffle")
    } else {
      alert("Raffle deleted successfully!")
      fetchRaffles()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Active Raffles</h1>
            <p className="text-slate-400 mt-1">Manage currently active raffle campaigns</p>
          </div>
          <Link href="/admin/raffles/create">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">
              Create New Raffle
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-8 text-center text-slate-400">Loading raffles...</CardContent>
          </Card>
        ) : raffles.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="py-8 text-center text-slate-400">
              No active raffles found. Create your first raffle!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {raffles.map((raffle) => (
              <Card key={raffle.id} className="border-slate-700 bg-slate-800/50">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h3 className="text-lg font-bold text-white">{raffle.title}</h3>
                        {raffle.featured && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Featured</Badge>
                        )}
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                      </div>
                      <p className="text-slate-400">{raffle.description}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-cyan-400" />
                          <span className="text-slate-300">{raffle.ticket_price} pts/ticket</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span className="text-slate-300">
                            Tickets: {raffle.tickets_sold}
                            {raffle.total_tickets_available && ` / ${raffle.total_tickets_available}`}
                          </span>
                        </div>
                        {raffle.prize_value && (
                          <div className="text-green-400 font-medium">${raffle.prize_value.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/admin/raffles/edit/${raffle.id}`)}
                        className="border-slate-600 hover:bg-slate-700"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(raffle.id)}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
