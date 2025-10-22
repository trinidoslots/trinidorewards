import { createServerClient } from "@/lib/supabase/server"
import { Trophy, Users, Calendar, DollarSign, Award, Target, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Tournament {
  id: string
  title: string
  description: string
  image_url: string
  prize_pool: number
  entry_fee: number
  max_participants: number
  current_participants: number
  tournament_type: string
  game_type: string
  status: string
  start_date: string
  end_date: string
  registration_deadline: string
  featured: boolean
  winner_username: string | null
  winner_prize: number | null
}

async function fetchTournaments(status: string) {
  const supabase = await createServerClient()

  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", status)
      .order("featured", { ascending: false })
      .order("start_date", { ascending: status === "active" || status === "registration" })

    if (error) {
      console.error("[v0] Error fetching tournaments:", error)
      // Check for table not found errors
      if (
        error.code === "PGRST205" ||
        error.code === "PGRST204" ||
        error.code === "42703" ||
        error.message?.includes("Could not find the table")
      ) {
        return null
      }
      throw error
    }

    return data as Tournament[]
  } catch (error: any) {
    console.error("[v0] Caught error in fetchTournaments:", error)
    // Additional catch for any errors that slip through
    if (
      error?.code === "PGRST205" ||
      error?.code === "PGRST204" ||
      error?.code === "42703" ||
      error?.message?.includes("Could not find the table")
    ) {
      return null
    }
    throw error
  }
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const startDate = new Date(tournament.start_date)
  const endDate = new Date(tournament.end_date)
  const registrationDeadline = tournament.registration_deadline ? new Date(tournament.registration_deadline) : null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "registration":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20"
      case "active":
        return "bg-green-500/10 text-green-400 border-green-500/20"
      case "completed":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20"
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20"
    }
  }

  const participationPercentage =
    tournament.max_participants > 0 ? (tournament.current_participants / tournament.max_participants) * 100 : 0

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden hover:border-cyan-500/30 transition-all duration-300 group">
      {/* Tournament Image */}
      {tournament.image_url && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={tournament.image_url || "/placeholder.svg"}
            alt={tournament.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          {tournament.featured && (
            <Badge className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              <Award className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
              {tournament.title}
            </h3>
            <Badge className={getStatusColor(tournament.status)}>{tournament.status.toUpperCase()}</Badge>
          </div>
          {tournament.description && <p className="text-sm text-slate-400 line-clamp-2">{tournament.description}</p>}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Prize Pool</span>
            </div>
            <p className="text-lg font-bold text-white">${tournament.prize_pool.toFixed(2)}</p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
            <div className="flex items-center gap-2 text-cyan-400 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Participants</span>
            </div>
            <p className="text-lg font-bold text-white">
              {tournament.current_participants}
              {tournament.max_participants > 0 && (
                <span className="text-sm text-slate-400">/{tournament.max_participants}</span>
              )}
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-medium">Entry Fee</span>
            </div>
            <p className="text-lg font-bold text-white">
              {tournament.entry_fee === 0 ? "FREE" : `$${tournament.entry_fee.toFixed(2)}`}
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs font-medium">Type</span>
            </div>
            <p className="text-sm font-bold text-white capitalize">{tournament.tournament_type}</p>
          </div>
        </div>

        {/* Participation Progress */}
        {tournament.max_participants > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Spots Filled</span>
              <span className="text-white font-medium">{participationPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${participationPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="space-y-2 pt-2 border-t border-slate-700/30">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Start:</span>
            <span className="text-white font-medium">{startDate.toLocaleDateString()}</span>
          </div>
          {registrationDeadline && tournament.status === "registration" && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">Registration Ends:</span>
              <span className="text-amber-400 font-medium">{registrationDeadline.toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Winner Display */}
        {tournament.status === "completed" && tournament.winner_username && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">WINNER</span>
            </div>
            <p className="text-white font-bold">{tournament.winner_username}</p>
            {tournament.winner_prize && (
              <p className="text-sm text-slate-300">Prize: ${tournament.winner_prize.toFixed(2)}</p>
            )}
          </div>
        )}

        {/* Action Button */}
        <Button
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold"
          disabled={
            tournament.status === "completed" ||
            (tournament.max_participants > 0 && tournament.current_participants >= tournament.max_participants)
          }
        >
          {tournament.status === "completed"
            ? "Tournament Ended"
            : tournament.status === "registration"
              ? "Register Now"
              : tournament.status === "active"
                ? "View Tournament"
                : "Coming Soon"}
        </Button>
      </div>
    </Card>
  )
}

export default async function TournamentsPage() {
  const activeTournaments = await fetchTournaments("active")
  const registrationTournaments = await fetchTournaments("registration")
  const completedTournaments = await fetchTournaments("completed")

  // Check if tables don't exist
  if (activeTournaments === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-slate-800/50 border-amber-500/20 p-8 text-center">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Database Setup Required</h2>
            <p className="text-slate-300 mb-4">
              The tournaments table hasn't been created yet. Please run the database setup script.
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-slate-400 mb-2">Run this script in your Supabase SQL editor:</p>
              <code className="text-xs text-cyan-400">scripts/020_create_tournaments.sql</code>
            </div>
            <Button asChild className="bg-cyan-600 hover:bg-cyan-500">
              <a href="/admin">Go to Admin Panel</a>
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  const allActiveTournaments = [...(registrationTournaments || []), ...(activeTournaments || [])]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-3 bg-slate-800/50 border border-cyan-500/20 rounded-full px-6 py-3">
              <Trophy className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">Compete & Win</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black">
              <span className="text-white">PARTICIPATE IN</span>
              <br />
              <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 bg-clip-text text-transparent">
                TOURNAMENTS
              </span>
            </h1>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Join competitive tournaments, showcase your skills, and win amazing prizes
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-slate-800/50 border-slate-700/50 p-8 text-center hover:border-green-500/30 transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-3 uppercase">Check Active Tournaments</h3>
              <p className="text-slate-300">
                Browse through our active tournaments and find one that matches your skill level and interests
              </p>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50 p-8 text-center hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-bold text-cyan-400 mb-3 uppercase">Register & Compete</h3>
              <p className="text-slate-300">
                Register for the tournament and compete against other players to climb the leaderboard
              </p>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50 p-8 text-center hover:border-amber-500/30 transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-bold text-amber-400 mb-3 uppercase">Win Prizes</h3>
              <p className="text-slate-300">
                Top performers win amazing prizes from the prize pool. The better you perform, the more you win!
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Tournaments Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="active" className="space-y-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-slate-800/50 border border-slate-700/50">
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Active
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-700 data-[state=active]:text-white"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6">
              {allActiveTournaments.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700/50 p-12 text-center">
                  <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No Active Tournaments</h3>
                  <p className="text-slate-400">Check back soon for new tournaments!</p>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allActiveTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-6">
              {!completedTournaments || completedTournaments.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700/50 p-12 text-center">
                  <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No Completed Tournaments</h3>
                  <p className="text-slate-400">Completed tournaments will appear here</p>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  )
}
