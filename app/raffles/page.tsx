import { createServerClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gift, Users, Ticket } from "lucide-react"
import Link from "next/link"

interface Raffle {
  id: string
  title: string
  description: string
  prize_name: string
  prize_value: number
  prize_image_url: string
  ticket_price: number
  max_tickets: number
  total_tickets_available: number
  tickets_sold: number
  start_date: string
  end_date: string
  draw_date: string
  status: string
  winner_username: string
  winner_ticket_number: number
  featured: boolean
  entry_type: string
}

async function fetchRaffles(status: string[]) {
  const supabase = await createServerClient()
  await supabase.rpc("update_raffle_status")

  const { data, error } = await supabase
    .from("raffles")
    .select("*")
    .in("status", status)
    .order("featured", { ascending: false })
    .order("end_date", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching raffles:", error)
    return []
  }

  return data as Raffle[]
}

async function getRaffleEntries(raffleId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase.from("raffle_entries").select("*").eq("raffle_id", raffleId)

  if (error) {
    console.error("[v0] Error fetching raffle entries:", error)
    return []
  }

  return data
}

function RaffleCard({ raffle, entries }: { raffle: Raffle; entries: number }) {
  const isFree = raffle.ticket_price === 0 || raffle.entry_type === "free"

  return (
    <Link href={`/raffles/${raffle.id}`}>
      <Card className="group relative overflow-hidden border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer">
        {/* Gift Icon */}
        <div className="flex items-center justify-center py-16 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Gift className="w-12 h-12 text-white" />
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          {/* Title and Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                {raffle.title}
              </h3>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">
                {raffle.status === "active" ? "Active" : raffle.status === "ended" ? "Ended" : "Drawn"}
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Users className="w-4 h-4" />
                <span>Entries</span>
              </div>
              <span className="text-white font-bold">{entries}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Users className="w-4 h-4" />
                <span>Winners</span>
              </div>
              <span className="text-white font-bold">1</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Ticket className="w-4 h-4" />
                <span>Entry Types</span>
              </div>
              <span className="text-white font-bold">{isFree ? "Free" : `${raffle.ticket_price} pts`}</span>
            </div>
          </div>

          {/* View Details Button */}
          <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white">
            <Gift className="w-4 h-4 mr-2" />
            View Details
          </Button>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function RafflesPage() {
  const activeRaffles = await fetchRaffles(["active"])
  const endedRaffles = await fetchRaffles(["ended", "drawn"])

  // Get entry counts for all raffles
  const activeRafflesWithEntries = await Promise.all(
    activeRaffles.map(async (raffle) => {
      const entries = await getRaffleEntries(raffle.id)
      return { raffle, entries: entries.length }
    }),
  )

  const endedRafflesWithEntries = await Promise.all(
    endedRaffles.map(async (raffle) => {
      const entries = await getRaffleEntries(raffle.id)
      return { raffle, entries: entries.length }
    }),
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />

        <div className="relative container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
              <Gift className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-6xl md:text-7xl font-black text-white">Raffles</h1>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto">Enter raffles to win amazing prizes and rewards!</p>
          </div>
        </div>
      </section>

      {/* Raffles Tabs */}
      <section className="container mx-auto px-4 py-16">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-slate-800 border border-slate-700">
            <TabsTrigger value="active" className="data-[state=active]:bg-cyan-600">
              Active Raffles
            </TabsTrigger>
            <TabsTrigger value="ended" className="data-[state=active]:bg-slate-700">
              Ended Raffles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-8">
            {activeRafflesWithEntries.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeRafflesWithEntries.map(({ raffle, entries }) => (
                  <RaffleCard key={raffle.id} raffle={raffle} entries={entries} />
                ))}
              </div>
            ) : (
              <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
                <CardContent className="py-16 text-center">
                  <Gift className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400 text-lg">No active raffles found.</p>
                  <p className="text-slate-500 text-sm mt-2">Check back soon for new raffles!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ended" className="mt-8">
            {endedRafflesWithEntries.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {endedRafflesWithEntries.map(({ raffle, entries }) => (
                  <RaffleCard key={raffle.id} raffle={raffle} entries={entries} />
                ))}
              </div>
            ) : (
              <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
                <CardContent className="py-16 text-center">
                  <Gift className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400 text-lg">No ended raffles yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}
