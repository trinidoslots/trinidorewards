import Link from "next/link"
import { cookies } from "next/headers"
import { Coins, Package, ShoppingBag } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ACCENTS, MonoLabel, Panel, StatTile } from "@/components/ui/panel"
import { StoreItemCard } from "@/components/store-item-card"
import { inStock, isAvailable, type StoreItem } from "@/lib/store"

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
      <div className="mx-auto max-w-6xl px-5 py-6">
        <Panel accent="red" className="p-6 text-center">
          <Package className="mx-auto h-8 w-8 text-white/15" />
          <p className="mt-3 text-[14px] text-white">The store could not be loaded.</p>
          <p className="mt-1 text-[12.5px] text-white/35">{error.message}</p>
        </Panel>
      </div>
    )
  }

  const items = ((data ?? []) as StoreItem[]).filter(isAvailable)
  const categories = Array.from(new Set(items.map((item) => item.category || "Uncategorised")))
  const affordable = items.filter((item) => inStock(item) && userPoints >= (Number(item.cost) || 0)).length

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Stream Store</h1>
          <p className="mt-1 text-[13px] text-white/40">Turn points into rewards.</p>
        </div>
        {isLoggedIn && (
          <Link
            href="/profile"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 transition hover:border-white/25"
          >
            <Coins className="h-3.5 w-3.5" style={{ color: ACCENTS.green }} />
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: ACCENTS.green }}>
              {userPoints.toLocaleString()}
            </span>
            <MonoLabel className="text-white/30">points</MonoLabel>
          </Link>
        )}
      </header>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Items listed" value={items.length.toLocaleString()} />
        <StatTile label="Categories" value={categories.length.toLocaleString()} accent="blue" />
        <StatTile
          label={isLoggedIn ? "You can afford" : "Sign in to buy"}
          value={isLoggedIn ? affordable.toLocaleString() : "—"}
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
    </div>
  )
}
