import { createServerClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { AdventCalendarClient } from "@/components/advent-calendar-client"
import type { AdventClaim, AdventReward } from "@/lib/advent"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Advent calendar",
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
      .select("day_number, claimed_at, reward_title, reward_icon, reward_value")
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

  // The header and the doors are drawn in the browser: which door is today's
  // depends on the viewer's own date (components/advent-calendar-client.tsx).
  return (
    <AdventCalendarClient
      rewardsByDay={rewardsByDay}
      claims={claims}
      userId={user?.id || null}
      username={user?.username || null}
    />
  )
}
