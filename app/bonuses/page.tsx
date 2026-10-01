import { Gift } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { BonusCatalog, BonusSpotlight, type Bonus } from "@/components/bonus-card"
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
  // Ordered featured-first, newest-first by the query, so this is the one to lead with.
  const lead = bonuses[0]

  return (
    <div>
      <PageHero
        accent="amber"
        title="Bonuses"
        subtitle="Codes and offers worth using. Copy the code, then claim it on the casino's site."
        note={
          bonuses.length > 0
            ? `${bonuses.length} ${bonuses.length === 1 ? "offer" : "offers"}${
                casinos.size ? ` · ${casinos.size} ${casinos.size === 1 ? "casino" : "casinos"}` : ""
              }`
            : "Bonuses"
        }
        aside={lead ? <BonusSpotlight bonus={lead} /> : undefined}
      />
      <PageBody>
        {error ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#0E0E12] p-8 text-center">
            <Gift className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-[15px] font-semibold text-white">Bonuses could not be loaded.</p>
            <p className="mt-1 text-[13px] text-white/45">Try again in a moment.</p>
          </div>
        ) : bonuses.length === 0 ? (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
              style={{ borderColor: `${ACCENTS.amber}44`, backgroundColor: `${ACCENTS.amber}14` }}
            >
              <Gift className="h-5 w-5" style={{ color: ACCENTS.amber }} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-white">No offers right now</p>
              <p className="mt-0.5 text-[13px] text-white/45">New codes show up here as soon as they are added.</p>
            </div>
          </div>
        ) : (
          <BonusCatalog bonuses={bonuses} />
        )}
      </PageBody>
    </div>
  )
}
