import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { PageTransition } from "@/components/page-transition"
import { ShoppingBag, Package, AlertCircle } from "lucide-react"
import { StoreItemCard } from "@/components/store-item-card"
import Link from "next/link"
import { cookies } from "next/headers"

type StoreItem = {
  id: string
  name: string
  description: string | null
  cost: number
  icon: string | null
  category: string | null
  quantity: number
  is_available: string
  created_at: string
}

export default async function StorePage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const kickUserId = cookieStore.get("kick_user_id")

  // Get user points if logged in
  let userPoints = 0
  if (kickUserId) {
    const { data: userData } = await supabase
      .from("users")
      .select("points_balance")
      .eq("kick_id", kickUserId.value)
      .single()
    userPoints = userData?.points_balance || 0
  }

  const { data: items, error } = await supabase
    .from("store_items")
    .select("*")
    .eq("is_available", "true")
    .order("created_at", { ascending: false })

  // Handle missing table error
  if (error) {
    console.error("[v0] Error fetching store items:", error)

    if (error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205") {
      return (
        <PageTransition>
          <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3">
            <div className="container mx-auto max-w-4xl">
              <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h2 className="text-white text-xl font-semibold mb-2">Store Setup Required</h2>
                  <p className="text-slate-400 text-sm mb-4">
                    The store database table needs to be created. Please run the SQL script in your Supabase SQL editor.
                  </p>
                  <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-700/50 text-left mb-4">
                    <p className="text-slate-300 text-xs font-mono mb-2">
                      Run: <span className="text-cyan-400">scripts/016_create_store.sql</span>
                    </p>
                  </div>
                  <Link
                    href="/admin/store"
                    className="inline-block px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Go to Admin Panel
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </PageTransition>
      )
    }
  }

  const storeItems = (items || []) as StoreItem[]
  const categories = Array.from(new Set(storeItems.map((item) => item.category || "Uncategorized")))

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-6 h-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Stream Store</h1>
              </div>
              <p className="text-slate-400 text-sm">Browse exclusive items and rewards</p>
            </div>
            {kickUserId && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                <span className="text-amber-400 text-xl">🪙</span>
                <div>
                  <p className="text-amber-400 text-xs">Your Points</p>
                  <p className="text-amber-400 text-lg font-bold">{userPoints.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {!kickUserId && (
            <Card className="bg-cyan-500/10 border-cyan-500/30 backdrop-blur mb-6">
              <CardContent className="p-4 text-center">
                <p className="text-cyan-400 text-sm">Please log in to purchase items and view your points balance</p>
              </CardContent>
            </Card>
          )}

          {storeItems.length === 0 ? (
            <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur">
              <CardContent className="p-12 text-center">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No items available yet. Check back soon!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => {
                const categoryItems = storeItems.filter((item) => (item.category || "Uncategorized") === category)

                return (
                  <div key={category}>
                    <h2 className="text-white text-lg font-semibold mb-3 flex items-center gap-2">
                      <div className="w-1 h-5 bg-cyan-500 rounded"></div>
                      {category}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {categoryItems.map((item) => (
                        <StoreItemCard key={item.id} item={item} userPoints={userPoints} isLoggedIn={!!kickUserId} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
