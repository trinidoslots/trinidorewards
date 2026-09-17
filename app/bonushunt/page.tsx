import { createClient } from "@/lib/supabase/server"
import { getActiveHunt } from "@/lib/active-hunt"
import { BonusHuntClient, type HuntKpis } from "@/components/bonus-hunt-client"
import { GuessTheBalancePanel } from "@/components/guess-the-balance-panel"
import { getCurrentExternalHuntMapped } from "@/lib/bonushunt-api"
import { cookies } from "next/headers"
import { PreviousHuntsPanel } from "@/components/previous-hunts-panel"
import { BonusHuntTabs } from "@/components/bonus-hunt-tabs"

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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(37,99,235,0.12),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="mb-8 overflow-hidden rounded-xl border border-cyan-200/15 bg-slate-900/80 p-5 shadow-lg shadow-cyan-950/20 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" /> Live community tracker
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl">Bonus hunts, live.</h1>
              <p className="mt-3 max-w-2xl text-pretty text-base leading-7 text-slate-300">Follow every hunt, watch the numbers move, and make your next spin count.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3"><p className="text-xs uppercase tracking-wider text-slate-500">Mode</p><p className="mt-1 font-semibold text-cyan-200">Live hunt</p></div>
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3"><p className="text-xs uppercase tracking-wider text-slate-500">Updates</p><p className="mt-1 font-semibold text-cyan-200">Realtime</p></div>
            </div>
          </div>
        </section>

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
      </div>
    </main>
  )
}
