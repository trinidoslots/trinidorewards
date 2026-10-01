import type { Metadata } from "next"
import { Target } from "lucide-react"
import { PageBody, PageHero } from "@/components/page-hero"
import { ChallengeSteps, ChallengeSummary, ChallengesBoard, type BoardChallenge } from "@/components/challenges-board"
import { createServerClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { getSiteSession } from "@/lib/site-session"
import { phaseOf, type Challenge, type SubmissionStatus } from "@/lib/challenges"

export const metadata: Metadata = {
  title: "Challenges",
}

// Per viewer (their own claims), and a claim should show the moment it is made.
export const dynamic = "force-dynamic"

/**
 * Slot challenges: hit the target on the slot, claim it with the bet.
 *
 * Challenges are public-read. The approved counts, winners and the viewer's own
 * claims come from challenge_submissions, which has no public policy, so they
 * are read here with the service role and only what the page needs is passed on.
 */
export default async function ChallengesPage() {
  const supabase = await createServerClient()
  const { data, error } = await supabase.from("challenges").select("*").order("starts_at", { ascending: false })

  if (error) {
    console.error("[challenges] Could not load challenges:", error)
    return (
      <div>
        <PageHero accent="red" title="Challenges" subtitle="Hit the target on the slot, claim the prize." />
        <PageBody>
          <div className="rounded-xl border border-white/[0.08] bg-[#0E0E12] p-8 text-center">
            <Target className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-[15px] font-semibold text-white">Challenges could not be loaded.</p>
            <p className="mt-1 text-[13px] text-white/45">Try again in a moment.</p>
          </div>
        </PageBody>
      </div>
    )
  }

  const challenges = (data ?? []) as Challenge[]
  const session = await getSiteSession()

  const winners = new Map<string, string[]>()
  const mine = new Map<string, SubmissionStatus>()
  if (challenges.length > 0) {
    const service = serviceClient()
    const ids = challenges.map((challenge) => challenge.id)
    const [{ data: approved }, { data: own }] = await Promise.all([
      service
        .from("challenge_submissions")
        .select("challenge_id, username")
        .eq("status", "approved")
        .in("challenge_id", ids)
        .order("reviewed_at", { ascending: true }),
      session
        ? service
            .from("challenge_submissions")
            .select("challenge_id, status, created_at")
            .eq("user_id", session.userId)
            .in("challenge_id", ids)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as { challenge_id: string; status: SubmissionStatus }[] }),
    ])
    for (const row of approved ?? []) {
      winners.set(row.challenge_id, [...(winners.get(row.challenge_id) ?? []), row.username])
    }
    // Oldest first, so a later claim (after a rejection) is the one that shows.
    for (const row of own ?? []) mine.set(row.challenge_id, row.status as SubmissionStatus)
  }

  const now = Date.now()
  const board: BoardChallenge[] = challenges.map((challenge) => {
    const won = winners.get(challenge.id) ?? []
    return {
      ...challenge,
      target_value: Number(challenge.target_value),
      min_bet: Number(challenge.min_bet),
      prize_amount: Number(challenge.prize_amount),
      phase: phaseOf(challenge, won.length, now),
      winners: won,
      myStatus: mine.get(challenge.id) ?? null,
    }
  })

  const live = board.filter((challenge) => challenge.phase === "active").length

  return (
    <div>
      <PageHero
        accent="red"
        note={live > 0 ? `${live} live now` : "Slot challenges"}
        title="Challenges"
        subtitle="Hit the target on the slot, send the bet, collect the prize."
        aside={<ChallengeSummary challenges={board} />}
      >
        <ChallengeSteps />
      </PageHero>
      <PageBody>
        <ChallengesBoard challenges={board} signedIn={!!session} />
      </PageBody>
    </div>
  )
}
