import Link from "next/link"
import { Coins, Package, ShoppingBag } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { createClient } from "@/lib/supabase/server"
import { serviceClient } from "@/lib/supabase/service"
import { StoreItemCard } from "@/components/store-item-card"
import { inStock, isAvailable, type StoreItem } from "@/lib/store"
import { PageBody, PageHero } from "@/components/page-hero"
import { SectionHeading } from "@/components/landing/parts"
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
  const categories = Array.from(new Set(items.map((item) => item.category || "Uncategorised")))
  const canBuy = (item: StoreItem) =>
    inStock(item) && userPoints >= (Number(item.cost) || 0) && (!item.code_user_only || isCodeUser)

  return (
    <div>
      <PageHero
        accent="pink"
        figure={isLoggedIn ? userPoints.toLocaleString("en-US") : undefined}
        figureLabel="Your points"
        title="Stream Store"
        subtitle="Turn points into rewards."
        note={items.length > 0 ? `${items.length} ${items.length === 1 ? "item" : "items"} listed` : "Restocking"}
        actions={
          isLoggedIn ? (
            <Link
              href="/profile"
              className="group inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
            >
              <Coins className="h-4 w-4" style={{ color: ACCENTS.green }} />
              Your profile
            </Link>
          ) : undefined
        }
      />
      <PageBody className="space-y-16">
        {items.length === 0 ? (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/[0.12] bg-[#0E0E12] px-6 py-6">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
              style={{ borderColor: `${ACCENTS.pink}44`, backgroundColor: `${ACCENTS.pink}14` }}
            >
              <ShoppingBag className="h-5 w-5" style={{ color: ACCENTS.pink }} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-white">Nothing in the store right now</p>
              <p className="mt-0.5 text-[13px] text-white/45">New rewards show up here as soon as they are listed.</p>
            </div>
          </div>
        ) : (
          categories.map((category) => {
            const inCategory = items.filter((item) => (item.category || "Uncategorised") === category)
            const affordable = inCategory.filter(canBuy).length
            return (
              <section key={category} className="space-y-6">
                <SectionHeading
                  eyebrow={`${inCategory.length} ${inCategory.length === 1 ? "item" : "items"}`}
                  title={category}
                  accent={ACCENTS.pink}
                  right={
                    isLoggedIn ? (
                      <span className="text-[13px]" style={{ color: affordable > 0 ? ACCENTS.green : "rgba(255,255,255,0.45)" }}>
                        {affordable > 0 ? `You can afford ${affordable}` : "Nothing affordable yet"}
                      </span>
                    ) : undefined
                  }
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inCategory.map((item) => (
                    <StoreItemCard
                      key={item.id}
                      item={item}
                      userPoints={userPoints}
                      isLoggedIn={isLoggedIn}
                      isCodeUser={isCodeUser}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </PageBody>
    </div>
  )
}
