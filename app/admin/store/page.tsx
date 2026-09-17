"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Plus, RefreshCw, Search, Filter, Pencil, Package } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type StoreItem = {
  id: string
  name: string
  description: string | null
  cost: number
  icon: string | null
  category: string | null
  type: string | null
  quantity: number
  is_available: string
  one_purchase_per_user: boolean
  created_at: string
}

export default function AdminStorePage() {
  const [items, setItems] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
    } else {
      await fetchItems()
      setLoading(false)
    }
  }

  async function fetchItems() {
    const { data, error } = await supabase.from("store_items").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching store items:", error)
      toast({
        title: "Error",
        description: "Failed to fetch store items",
        variant: "destructive",
      })
    } else {
      setItems((data || []) as StoreItem[])
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 min-h-screen bg-[#0B0B0D]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Search & Filter</h1>
        </div>

        {/* Search and Actions */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/[0.06] border-white/[0.10] text-white pl-10 h-10"
              placeholder="Search"
            />
          </div>
          <Button variant="ghost" size="sm" className="bg-white/[0.08] hover:bg-white/[0.10] text-white h-10 px-4">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="bg-[#5B8DEF] hover:bg-[#5B8DEF] text-white h-10 px-4">
            <Search className="w-4 h-4" />
          </Button>
          <div className="flex-1"></div>
          <Link href="/admin/store/redemptions">
            <Button className="bg-purple-500 hover:bg-purple-600 text-white h-10">
              <Package className="w-4 h-4 mr-2" />
              REDEMPTIONS
            </Button>
          </Link>
          <Link href="/admin/store/add">
            <Button className="bg-[#5B8DEF] hover:bg-[#5B8DEF] text-white h-10">
              <Plus className="w-4 h-4 mr-2" />
              ADD
            </Button>
          </Link>
          <Button
            onClick={fetchItems}
            variant="outline"
            className="bg-transparent border-white/[0.12] hover:bg-white/[0.06] text-white h-10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            REFRESH
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white/[0.022] backdrop-blur border border-white/[0.06] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-white/40 font-semibold text-sm">
                  <input type="checkbox" className="rounded border-white/[0.12]" />
                </th>
                <th className="text-left p-4 text-white/40 font-semibold text-sm uppercase tracking-wider">ITEM</th>
                <th className="text-left p-4 text-white/40 font-semibold text-sm uppercase tracking-wider">PRICE</th>
                <th className="text-left p-4 text-white/40 font-semibold text-sm uppercase tracking-wider">
                  CREATED ↓
                </th>
                <th className="text-left p-4 text-white/40 font-semibold text-sm uppercase tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-white/[0.06] hover:bg-white/[0.06]/30 transition-colors">
                  <td className="p-4">
                    <input type="checkbox" className="rounded border-white/[0.12]" />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-white/30 text-xs font-mono">{item.id.slice(0, 12)}...</div>
                      {item.icon && (
                        <img
                          src={item.icon || "/placeholder.svg"}
                          alt={item.name}
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <span className="text-white font-medium">{item.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-white">{item.cost.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-white/40 text-sm">
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="p-4">
                    <Link href={`/admin/store/edit/${item.id}`}>
                      <Button variant="ghost" size="sm" className="text-white/40 hover:text-white">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/40">No items found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
