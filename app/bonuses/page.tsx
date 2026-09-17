import Link from "next/link"
import { ExternalLink, Gift } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"
import { CopyableId } from "@/components/ui/copyable-id"

type Bonus = {
  id: string
  title: string
  description: string | null
  code: string | null
  terms: string | null
  value: string | null
  casino_name: string | null
  casino_url: string | null
  image_url: string | null
  is_active: boolean
  featured: boolean
}

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
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Bonuses</h1>
        <p className="mt-1 text-[13px] text-white/40">Codes and offers worth using.</p>
      </header>

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
    </div>
  )
}

function BonusCard({ bonus }: { bonus: Bonus }) {
  return (
    <Panel accent={bonus.featured ? "amber" : "blue"} className="flex h-full flex-col overflow-hidden">
      {bonus.image_url ? (
        <img src={bonus.image_url} alt="" className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 w-full items-center justify-center bg-white/[0.02]">
          <Gift className="h-8 w-8 text-white/10" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold text-white">{bonus.title}</h3>
            {bonus.casino_name && <MonoLabel className="text-white/25">{bonus.casino_name}</MonoLabel>}
          </div>
          {bonus.featured && <Tag accent="amber">Featured</Tag>}
        </div>

        {bonus.value && (
          <p className="text-[17px] font-semibold" style={{ color: ACCENTS.green }}>
            {bonus.value}
          </p>
        )}

        {bonus.description && <p className="line-clamp-3 text-[12px] text-white/35">{bonus.description}</p>}

        <div className="mt-auto space-y-2 border-t border-white/[0.06] pt-2.5">
          {bonus.code && (
            <div className="flex items-center justify-between gap-2">
              <MonoLabel className="text-white/25">Code</MonoLabel>
              {/* Click to copy — a code you have to select by hand is the one
                  thing on this card that has to be exact. */}
              <CopyableId value={bonus.code} chars={12} />
            </div>
          )}

          {bonus.casino_url && (
            <Link
              href={bonus.casino_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md font-mono text-[11px] uppercase tracking-[0.1em] text-black transition"
              style={{ backgroundColor: ACCENTS.blue }}
            >
              Claim
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}

          {bonus.terms && <p className="line-clamp-2 text-[10.5px] leading-snug text-white/20">{bonus.terms}</p>}
        </div>
      </div>
    </Panel>
  )
}
