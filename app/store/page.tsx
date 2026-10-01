import { Package } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { StoreCatalog, StoreEmpty, StoreSteps, StoreWallet } from "@/components/store-catalog"
import { isAvailable, type StoreItem } from "@/lib/store"
import { PageBody, PageHero } from "@/components/page-hero"
import type { Metadata } from "next"
import { getSiteSession } from "@/lib/site-session"

export const metadata: Metadata = {
  title: "Store",
}

/**
 * The store.
 *
 * Availability is filtered here rather than in the query: is_available is a
 * text column holding "true"/"false", so `.eq("is_available", "true")` misses
 * anything stored as a boolean, "TRUE" or "1". One shared reader decides.
 */
export default async function StorePage() {
  const supabase = await createClient()
  const session = await getSiteSession()
  const kickUserId = session ? { value: session.kickId } : undefined
  const isLoggedIn = !!kickUserId

  let userPoints = 0
  let isCodeUser = false
  if (kickUserId) {
    // users is not publicly readable (scripts/072); this is the signed-in
    // user's own balance, by the Kick id in their signed session. "*" because
    // is_code_user only exists once scripts/076 has run.
    const { data } = await serviceClient()
      .from("users")
      .select("*")
      .eq("kick_id", kickUserId.value)
      .maybeSingle()
    userPoints = Number(data?.points_balance) || 0
    isCodeUser = data?.is_code_user === true
  }

  const { data, error } = await supabase.from("store_items").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching store items:", error)
    return (
      <div>
        <PageHero accent="pink" title="Stream Store" subtitle="Turn points into rewards." />
        <PageBody>
          <div className="rounded-xl border border-white/[0.08] bg-[#0E0E12] p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-[15px] font-semibold text-white">The store could not be loaded.</p>
            <p className="mt-1 text-[13px] text-white/45">Try again in a moment.</p>
          </div>
        </PageBody>
      </div>
    )
  }

  const items = ((data ?? []) as StoreItem[]).filter(isAvailable)
  const viewer = { userPoints, isLoggedIn, isCodeUser }

  return (
    <div>
      <PageHero
        accent="pink"
        title="Stream Store"
        subtitle="Spend the points you collect on stream on real rewards."
        note={items.length > 0 ? `${items.length} ${items.length === 1 ? "reward" : "rewards"} listed` : "Restocking"}
        aside={<StoreWallet items={items} {...viewer} />}
      >
        <StoreSteps />
      </PageHero>
      <PageBody>
        {items.length === 0 ? <StoreEmpty /> : <StoreCatalog items={items} {...viewer} />}
      </PageBody>
    </div>
  )
}
