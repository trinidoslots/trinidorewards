import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"

/**
 * Opens today's advent door: picks the reward and records the claim.
 *
 * Both used to happen in the browser. The page rolled the reward itself and
 * wrote the claim straight into advent_calendar_claims with the anon key, so
 * anyone could claim any reward, for any day, for any user id. Now the server
 * checks who is asking (the signed session), that the door is today's, and
 * rolls the reward; the page only plays the animation for the result.
 *
 * "Today" is allowed a day either side of the server's UTC date, so a viewer
 * whose evening is already tomorrow in UTC (or still yesterday) is not locked
 * out of the door their own calendar shows. One claim per user and day is
 * the table's own unique constraint.
 */

type Reward = {
  id: string
  day_number: number
  title: string
  description: string | null
  icon: string | null
  reward_value: string | null
  probability: number | null
}

function pick(rewards: Reward[]): Reward {
  const weights = rewards.map((reward) => Math.max(0, Number(reward.probability) || 0))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return rewards[crypto.randomInt(rewards.length)]
  // crypto rather than Math.random: the roll decides a prize.
  let roll = (crypto.randomInt(1_000_000) / 1_000_000) * total
  for (let index = 0; index < rewards.length; index++) {
    roll -= weights[index]
    if (roll < 0) return rewards[index]
  }
  return rewards[rewards.length - 1]
}

export async function POST(request: Request) {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ error: "Please log in to claim rewards." }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { day_number?: unknown } | null
  const day = Number(body?.day_number)
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "Which day?" }, { status: 400 })
  }

  const now = new Date()
  if (now.getUTCMonth() !== 11 || Math.abs(day - now.getUTCDate()) > 1) {
    return NextResponse.json({ error: "That door is not open today." }, { status: 403 })
  }

  const client = serviceClient()
  const { data: rewards, error } = await client
    .from("advent_calendar_rewards")
    .select("id, day_number, title, description, icon, reward_value, probability")
    .eq("day_number", day)
    .eq("is_active", true)
  if (error) {
    console.error("[advent] rewards:", error)
    return NextResponse.json({ error: "Could not load the rewards." }, { status: 500 })
  }
  if (!rewards?.length) return NextResponse.json({ error: "Nothing behind this door." }, { status: 404 })

  const reward = pick(rewards as Reward[])
  const { error: insertError } = await client.from("advent_calendar_claims").insert({
    user_id: session.userId,
    username: session.username,
    day_number: day,
    reward_id: reward.id,
    reward_title: reward.title,
    reward_description: reward.description,
    reward_icon: reward.icon,
    reward_value: reward.reward_value,
  })

  if (insertError) {
    // 23505: the unique (user_id, day_number) constraint, a second claim.
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "You've already claimed this reward." }, { status: 409 })
    }
    console.error("[advent] claim:", insertError)
    return NextResponse.json({ error: "Could not record the claim." }, { status: 500 })
  }

  return NextResponse.json({ reward })
}
