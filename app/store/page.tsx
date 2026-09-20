import Link from "next/link"
import { Coins, Package, ShoppingBag } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, StatTile } from "@/components/ui/panel"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { StoreItemCard } from "@/components/store-item-card"
import { inStock, isAvailable, type StoreItem } from "@/lib/store"
import { PageBody, PageHero } from "@/components/page-hero"

/**
 * The store.
 *
 * Availability is filtered here rather than in the query: is_available is a
 * text column holding "true"/"false", so `.eq("is_available", "true")` misses
 * anything stored as a boolean, "TRUE" or "1". One shared reader decides.
 */
export default async function StorePage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const kickUserId = cookieStore.get("kick_user_id")
  const isLoggedIn = !!kickUserId

  let userPoints = 0
  if (kickUserId) {
    const { data } = await supabase
      .from("users")
      .select("points_balance")
      .eq("kick_id", kickUserId.value)
      .maybeSingle()
    userPoints = Number(data?.points_balance) || 0
  }

  const { data, error } = await supabase.from("store_items").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching store items:", error)
    return (
      <div>
        <PageHero accent="pink" title="Stream Store" subtitle="Turn points into rewards." />
        <PageBody>
          <Panel accent="red" className="p-6 text-center">
            <Package className="mx-auto h-8 w-8 text-white/15" />
            <p className="mt-3 text-[14px] text-white">The store could not be loaded.</p>
            <p className="mt-1 text-[12.5px] text-white/35">{error.message}</p>
          </Panel>
        </PageBody>
      </div>
    )
  }

  const items = ((data ?? []) as StoreItem[]).filter(isAvailable)
  const categories = Array.from(new Set(items.map((item) => item.category || "Uncategorised")))
  const affordable = items.filter((item) => inStock(item) && userPoints >= (Number(item.cost) || 0)).length

  return (
    <div>
      <PageHero
        accent="pink"
        figure={isLoggedIn ? userPoints.toLocaleString("en-US") : undefined}
        figureLabel={isLoggedIn ? "Your points" : undefined}
        title="Stream Store"
        subtitle="Turn points into rewards."
        actions={
          isLoggedIn ? (
            <Link
              href="/profile"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 transition hover:border-white/25"
            >
              <Coins className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} />
              <MonoLabel className="text-white/40">Your profile</MonoLabel>
            </Link>
          ) : undefined
        }
      />
      <PageBody className="space-y-4">

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Items listed" value={items.length.toLocaleString("en-US")} />
        <StatTile label="Categories" value={categories.length.toLocaleString("en-US")} accent="blue" />
        <StatTile
          label={isLoggedIn ? "You can afford" : "Sign in to buy"}
          value={isLoggedIn ? affordable.toLocaleString("en-US") : "—"}
          accent="green"
        />
      </div>

      {items.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 py-16">
          <ShoppingBag className="h-8 w-8 text-white/10" />
          <p className="text-[13px] text-white/30">Nothing in the store right now.</p>
        </Panel>
      ) : (
        categories.map((category) => {
          const inCategory = items.filter((item) => (item.category || "Uncategorised") === category)
          return (
            <section key={category} className="space-y-2.5">
              <MonoLabel className="text-white/30">{category}</MonoLabel>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {inCategory.map((item) => (
                  <StoreItemCard key={item.id} item={item} userPoints={userPoints} isLoggedIn={isLoggedIn} />
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
