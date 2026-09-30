import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { phaseOf, readCasinoId, type Challenge } from "@/lib/challenges"

/**
 * A viewer claims a slot challenge with the Stake bet that hit it.
 *
 * The name and account come from the signed session, never the body. The bet
 * id has to be "casino:" and digits; the admin reviews every claim before it
 * counts. challenge_submissions has no public policy, so this route (service
 * role) is the only way in.
 */
export async function POST(request: Request) {
  const session = await getSiteSession()
  if (!session) return NextResponse.json({ error: "Sign in to claim a challenge." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : ""
  const betId = readCasinoId(body?.casinoId)
  if (!challengeId) return NextResponse.json({ error: "Which challenge?" }, { status: 400 })
  if (!betId) {
    return NextResponse.json(
      { error: 'That is not a casino ID. It looks like "casino:519440954076": casino, a colon, then numbers.' },
      { status: 400 },
    )
  }

  const client = serviceClient()
  const { data: challenge, error } = await client.from("challenges").select("*").eq("id", challengeId).maybeSingle()
  if (error) {
    console.error("[challenges] Could not read the challenge:", error)
    return NextResponse.json({ error: "Could not check that challenge. Try again." }, { status: 500 })
  }
  if (!challenge) return NextResponse.json({ error: "That challenge does not exist." }, { status: 404 })

  const { count: approved } = await client
    .from("challenge_submissions")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .eq("status", "approved")

  const phase = phaseOf(challenge as Challenge, approved ?? 0)
  if (phase === "upcoming") return NextResponse.json({ error: "This challenge has not started yet." }, { status: 409 })
  if (phase === "completed") return NextResponse.json({ error: "This challenge is already over." }, { status: 409 })

  const { data: submission, error: insertError } = await client
    .from("challenge_submissions")
    .insert({ challenge_id: challengeId, user_id: session.userId, username: session.username, bet_id: betId })
    .select("id, status, bet_id, created_at")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      const message = insertError.message.includes("bet")
        ? "That bet has already been submitted."
        : "You already have a claim on this challenge."
      return NextResponse.json({ error: message }, { status: 409 })
    }
    console.error("[challenges] Could not save the claim:", insertError)
    return NextResponse.json({ error: "Could not save your claim. Try again." }, { status: 500 })
  }

  return NextResponse.json({ submission })
}
