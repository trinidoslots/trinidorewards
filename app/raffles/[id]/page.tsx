import { Button } from "@/components/ui/button"
import { createServerClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Gift, Users, ArrowLeft, RefreshCw, Ticket } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import RaffleEntryButton from "@/components/raffle-entry-button"

interface RaffleEntry {
  id: string
  username: string
  tickets_purchased: number
}

async function getRaffle(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase.from("raffles").select("*").eq("id", id).single()

  if (error || !data) {
    return null
  }

  return data
}

async function getRaffleEntries(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase.from("raffle_entries").select("*").eq("raffle_id", id)

  if (error) {
    console.error("[v0] Error fetching raffle entries:", error)
    return []
  }

  return data as RaffleEntry[]
}

export default async function RaffleDetailPage({ params }: { params: { id: string } }) {
  const raffle = await getRaffle(params.id)

  if (!raffle) {
    notFound()
  }

  const entries = await getRaffleEntries(params.id)
  const totalEntries = entries.reduce((sum, entry) => sum + entry.tickets_purchased, 0)
  const isFree = raffle.ticket_price === 0 || raffle.entry_type === "free"

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />

        <div className="relative container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
              <Gift className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-5xl md:text-6xl font-black text-white">Raffle Details</h1>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              View raffle information, entries, and participate to win amazing prizes!
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/raffles"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Raffles
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Raffle Image */}
              <Card className="border-slate-700 bg-slate-800/50 backdrop-blur overflow-hidden">
                <div className="flex items-center justify-center py-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Gift className="w-16 h-16 text-white" />
                  </div>
                </div>
              </Card>

              {/* Description */}
              <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-4">Description</h2>
                  <p className="text-slate-300">{raffle.description || "No description provided."}</p>
                </CardContent>
              </Card>

              {/* Entries List */}
              <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-400" />
                      <h2 className="text-xl font-bold text-white">Entries ({totalEntries})</h2>
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-600 hover:bg-slate-700 bg-transparent">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  <Input
                    placeholder="Search participants..."
                    className="mb-4 bg-slate-900 border-slate-700 text-white"
                  />

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {entries.length > 0 ? (
                      entries.map((entry, index) => {
                        const winChance = totalEntries > 0 ? (entry.tickets_purchased / totalEntries) * 100 : 0
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                                #{index + 1}
                              </div>
                              <div>
                                <div className="text-white font-medium">{entry.username}</div>
                                <div className="text-slate-400 text-sm">{entry.tickets_purchased} ticket(s)</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-green-400 font-bold">{winChance.toFixed(2)}%</div>
                              <div className="text-slate-500 text-xs">win chance</div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-400">No entries yet. Be the first to enter!</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Raffle Stats */}
              <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-lg font-bold text-white">Raffle Stats</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Total Entries</span>
                      </div>
                      <span className="text-white font-bold">{totalEntries}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Winners</span>
                      </div>
                      <span className="text-white font-bold">1</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Entry Methods */}
              <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-lg font-bold text-white">Entry Methods</h3>

                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2 text-green-400">
                      <Ticket className="w-4 h-4" />
                      <span className="font-medium">{isFree ? "Free Entry" : `${raffle.ticket_price} Points`}</span>
                    </div>
                  </div>

                  <RaffleEntryButton raffleId={params.id} isFree={isFree} ticketPrice={raffle.ticket_price} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
