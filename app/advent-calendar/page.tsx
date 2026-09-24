import { createServerClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { AdventCalendarClient } from "@/components/advent-calendar-client"
import { PageBody, PageHero } from "@/components/page-hero"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Advent calendar",
}

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
    // Claims are private (scripts/072): this user's own, by their session id.
    const { data: claimsData, error: claimsError } = await serviceClient()
      .from("advent_calendar_claims")
      .select("day_number, claimed_at, reward_title, reward_icon")
      .eq("user_id", userId)

    if (!claimsError && claimsData) {
      claims = claimsData
    }
  }

  return { rewardsByDay, claims }
}

/**
 * The signed-in user, from the signed site session. This asked Supabase auth
 * before, which only admins have, so for everyone else the calendar never
 * knew who they were.
 */
async function getCurrentUser() {
  const session = await getSiteSession()
  return session ? { id: session.userId, username: session.username } : null
}

export default async function AdventCalendarPage() {
  const user = await getCurrentUser()
  const { rewardsByDay, claims } = await getAdventData(user?.id || null)

  return (
    <div>
      <PageHero
        accent="red"
        title="Advent Calendar"
        subtitle="Unwrap daily surprises throughout December."
        note="1st to 24th · a new door every day"
      />
      <PageBody>
        <AdventCalendarClient
          rewardsByDay={rewardsByDay}
          claims={claims}
          userId={user?.id || null}
          username={user?.username || null}
        />

        <footer className="mt-16 space-y-2 text-center text-white/25">
          <p className="text-[13px]">TrinidoRewards Community</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em]">Terms may apply · Strictly 18+ only</p>
        </footer>
      </PageBody>
    </div>
  )
}
