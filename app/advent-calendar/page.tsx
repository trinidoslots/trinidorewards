import { createServerClient } from "@/lib/supabase/server"
import { AdventCalendarClient } from "@/components/advent-calendar-client"

interface AdventReward {
  id: string
  day_number: number
  title: string
  description: string
  icon: string
  reward_type: string
  reward_value: string
  is_active: boolean
  probability: number
}

interface AdventClaim {
  day_number: number
  claimed_at: string
  reward_title?: string
  reward_icon?: string
}

async function getAdventData(userId: string | null) {
  const supabase = await createServerClient()

  const { data: rewards, error: rewardsError } = await supabase
    .from("advent_calendar_rewards")
    .select("*")
    .eq("is_active", true)
    .order("day_number", { ascending: true })
    .order("display_order", { ascending: true })

  if (rewardsError) {
    console.error("[v0] Error fetching advent rewards:", rewardsError)
    return { rewardsByDay: {}, claims: [] }
  }

  // Group rewards by day
  const rewardsByDay: Record<number, AdventReward[]> = {}
  for (const reward of rewards as AdventReward[]) {
    if (!rewardsByDay[reward.day_number]) {
      rewardsByDay[reward.day_number] = []
    }
    rewardsByDay[reward.day_number].push(reward)
  }

  let claims: AdventClaim[] = []
  if (userId) {
    const { data: claimsData, error: claimsError } = await supabase
      .from("advent_calendar_claims")
      .select("day_number, claimed_at, reward_title, reward_icon")
      .eq("user_id", userId)

    if (!claimsError && claimsData) {
      claims = claimsData
    }
  }

  return { rewardsByDay, claims }
}

async function getCurrentUser() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: userData } = await supabase.from("users").select("id, username").eq("id", user.id).single()

  return userData
}

export default async function AdventCalendarPage() {
  const user = await getCurrentUser()
  const { rewardsByDay, claims } = await getAdventData(user?.id || null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-12">
        <header className="text-center mb-16 space-y-4">
          <div className="inline-block">
            <h1 className="text-6xl md:text-7xl font-black mb-2 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 bg-clip-text text-transparent animate-pulse">
              Advent Calendar
            </h1>
            <div className="h-1 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded-full" />
          </div>
          <p className="text-xl text-slate-300 font-medium">Unwrap daily surprises throughout December</p>
          <p className="text-sm text-slate-500">December 1st - 24th • New rewards unlock every day</p>
        </header>

        <AdventCalendarClient
          rewardsByDay={rewardsByDay}
          claims={claims}
          userId={user?.id || null}
          username={user?.username || null}
        />

        <footer className="text-center mt-16 text-slate-500 text-sm space-y-2">
          <p>TrinidoRewards Community</p>
          <p className="text-xs">Terms may apply • Strictly 18+ only</p>
        </footer>
      </div>
    </div>
  )
}
