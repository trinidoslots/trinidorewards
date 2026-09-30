import { Gift } from "lucide-react"
import { Panel, StatTile } from "@/components/ui/panel"
import { BonusCard, type Bonus } from "@/components/bonus-card"
import { createServerClient } from "@/lib/supabase/server"
import { PageBody, PageHero } from "@/components/page-hero"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Bonuses",
}

/**
 * Bonus offers change by the week, not the second.
 */
export const revalidate = 120

async function fetchBonuses(): Promise<{ bonuses: Bonus[]; error: string | null }> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("bonuses")
    .select("*")
    .eq("is_active", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching bonuses:", error)
    return { bonuses: [], error: error.message }
  }
  return { bonuses: (data ?? []) as Bonus[], error: null }
}

export default async function BonusesPage() {
  const { bonuses, error } = await fetchBonuses()
  const casinos = new Set(bonuses.map((bonus) => bonus.casino_name).filter(Boolean))

  return (
    <div>
      <PageHero
        accent="amber"
        figure={bonuses.length || undefined}
        figureLabel={bonuses.length ? "Live offers" : undefined}
        title="Bonuses"
        subtitle="Codes and offers worth using."
        note={casinos.size ? `Across ${casinos.size} ${casinos.size === 1 ? "casino" : "casinos"}` : undefined}
      />
      <PageBody className="space-y-4">

      {error ? (
        <Panel accent="red" className="p-6 text-center">
          <Gift className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-[14px] text-white">Bonuses could not be loaded.</p>
          <p className="mt-1 text-[12.5px] text-white/35">{error}</p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <StatTile label="Offers live" value={bonuses.length.toLocaleString()} accent="green" />
            <StatTile label="Casinos" value={casinos.size.toLocaleString()} accent="blue" />
          </div>

          {bonuses.length === 0 ? (
            <Panel className="flex flex-col items-center gap-2 py-16">
              <Gift className="h-8 w-8 text-white/10" />
              <p className="text-[13px] text-white/30">No bonuses right now.</p>
            </Panel>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {bonuses.map((bonus) => (
                <BonusCard key={bonus.id} bonus={bonus} />
              ))}
            </div>
          )}
        </>
      )}
      </PageBody>
    </div>
  )
}
