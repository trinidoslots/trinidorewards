import { createClient } from "@/lib/supabase/server"
import { getActiveHunt } from "@/lib/active-hunt"
import { BonusHuntClient, type HuntKpis } from "@/components/bonus-hunt-client"
import { GuessTheBalancePanel } from "@/components/guess-the-balance-panel"
import { getCurrentExternalHuntMapped } from "@/lib/bonushunt-api"
import { cookies } from "next/headers"
import { PreviousHuntsPanel } from "@/components/previous-hunts-panel"
import { BonusHuntTabs } from "@/components/bonus-hunt-tabs"
import { PageBody, PageHero } from "@/components/page-hero"

type PageProps = {
  searchParams: Promise<{ tab?: string }>
}

type BonusHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
  is_super: boolean
  image_url?: string | null
}

export default async function BonusHuntPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeTab = params.tab || "current"

  const supabase = await createClient()
  const cookieStore = await cookies()

  const username = cookieStore.get("kick_username")?.value
  const isLoggedIn = !!username

  const { data: huntSourceData } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "hunt_source")
    .maybeSingle()

  const huntSource = huntSourceData?.value === "external" ? "external" : "integrated"

  let allHunts: BonusHunt[] = []
  let externalHuntId: string | null = null
  let externalHuntTitle: string | null = null
  let activeStartingBalance = 0
  let initialKpis: HuntKpis | null = null

  if (huntSource === "external") {
    try {
      const { hunt, rows } = await getCurrentExternalHuntMapped()
      allHunts = rows as BonusHunt[]
      externalHuntId = hunt?.id ?? null
      externalHuntTitle = hunt?.title ?? null
    } catch (e) {
      console.error("[v0] Error fetching external hunt:", e)
      allHunts = []
    }
  } else {
    const activeHunt = await getActiveHunt(supabase)
    if (activeHunt) {
      activeStartingBalance = Number(activeHunt.starting_balance ?? 0)
      const { data: bonuses, error: bonusError } = await supabase
        .from("hunt_bonuses")
        .select("id, game_name, provider, bet_size, result, created_at, is_super, image_url, position")
        .eq("hunt_id", activeHunt.id)
        .order("position", { ascending: true })
      if (bonusError) console.error("[v0] Error fetching hunt bonuses:", bonusError)
      allHunts = (bonuses || []).map((bonus) => ({ ...bonus, opening_balance: 0, starting_balance: activeHunt.starting_balance })) as BonusHunt[]
      externalHuntId = activeHunt.id

      const { data: kpiRow, error: kpiError } = await supabase
        .from("bonus_hunt_kpis")
        .select("*")
        .eq("hunt_id", activeHunt.id)
        .maybeSingle()
      if (kpiError) console.error("[v0] Error fetching hunt kpis:", kpiError)
      initialKpis = (kpiRow as HuntKpis | null) ?? null
    }
  }

  const hunts = allHunts

  const totalBetSize = hunts.reduce((sum, hunt) => sum + Number(hunt.bet_size), 0)
  const totalWinsSoFar = hunts.reduce((sum, hunt) => sum + (Number(hunt.result) || 0), 0)

  const startingBalance = activeStartingBalance || Number(hunts[0]?.starting_balance ?? 0)
  const openingBalance = Number(hunts[0]?.opening_balance ?? 0)

  const remainingBonuses = hunts.filter((hunt) => hunt.result === null || hunt.result === 0)
  const remainingStakes = remainingBonuses.map((hunt) => Number(hunt.bet_size))
  const totalRemainingStakes = remainingStakes.reduce((sum, stake) => sum + stake, 0)

  let breakEvenX = 0
  if (totalRemainingStakes > 0) {
    const missing = startingBalance - totalWinsSoFar
    breakEvenX = missing / totalRemainingStakes
    breakEvenX = Math.max(0, breakEvenX)
  }

  const completedHunts = hunts.filter((hunt) => hunt.result !== null && hunt.result > 0)
  const totalBonuses = hunts.length
  const unopenedCount = remainingBonuses.length

  const averageBet = totalBonuses > 0 ? totalBetSize / totalBonuses : 0

  const totalMultiplier = completedHunts.reduce((sum, hunt) => {
    if (hunt.result && hunt.bet_size) {
      return sum + Number(hunt.result) / Number(hunt.bet_size)
    }
    return sum
  }, 0)
  const averageMultiplier = completedHunts.length > 0 ? totalMultiplier / completedHunts.length : 0

  const winRate = completedHunts.length > 0 ? averageMultiplier : 0

  const highestMultiplierData = completedHunts.reduce(
    (max, hunt) => {
      if (hunt.result && hunt.bet_size) {
        const multiplier = Number(hunt.result) / Number(hunt.bet_size)
        if (multiplier > max.multiplier) {
          return {
            multiplier: multiplier,
            game: hunt.game_name,
            provider: hunt.provider,
            betsize: hunt.bet_size,
          }
        }
      }
      return max
    },
    { multiplier: 0, game: "", provider: null as string | null, betsize: 0 },
  )

  const highestWin = completedHunts.reduce(
    (max, hunt) => {
      if (hunt.result && Number(hunt.result) > max.amount) {
        return {
          game: hunt.game_name,
          amount: Number(hunt.result),
          betSize: Number(hunt.bet_size),
          provider: hunt.provider,
        }
      }
      return max
    },
    { game: "", amount: 0, betSize: 0, provider: null as string | null },
  )

  const highestWinMultiplier = highestWin.betSize > 0 ? highestWin.amount / highestWin.betSize : 0

  const profitLoss = totalWinsSoFar - startingBalance

  const hasActiveHunt = hunts.length > 0

  return (
    <div>
      <PageHero
        accent="amber"
        title="Bonus hunt"
        subtitle="Every bonus as it is collected, the running numbers, and how far the remaining spins have to carry it."
        note={hasActiveHunt ? "Live" : "Idle"}
      />
      <PageBody className="max-w-7xl">
      <BonusHuntTabs
        initialTab={activeTab === "previous" ? "previous" : "current"}
        currentContent={
          <>
            {huntSource === "external" && (
              <GuessTheBalancePanel
                externalHuntId={externalHuntId}
                huntTitle={externalHuntTitle}
                currentUsername={username}
              />
            )}
            <BonusHuntClient
              initialHunts={allHunts}
              activeTab="current"
              huntSource={huntSource}
              huntId={externalHuntId}
              initialStartingBalance={startingBalance}
              initialKpis={initialKpis}
              currentUsername={username}
            />
          </>
        }
        previousContent={<PreviousHuntsPanel />}
      />
      </PageBody>
    </div>
  )
}
