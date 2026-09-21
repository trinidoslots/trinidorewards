"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { use, useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PayoutMethodField, StoreImageField } from "@/components/admin/store-item-fields"
import { SelectMenu } from "@/components/ui/select-menu"

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
  payout_method: string | null
  one_purchase_per_user: boolean
}

/**
 * Editing one store item.
 *
 * `params` is a Promise in Next 16, so reading params.id straight off it gave
 * undefined: the lookup matched nothing, `.single()` errored, and the page
 * bounced straight back to the list. Editing an item had simply stopped
 * working. use() unwraps it.
 */
export default function EditStoreItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = use(params)

  const [item, setItem] = useState<StoreItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    cost: "",
    quantity: "",
    type: "Digital",
    is_available: "true",
    // Neither of these was editable before — an item's artwork could only ever
    // be set at creation, and there was nowhere to change it afterwards.
    icon: "",
    payout_method: "",
  })
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchItem()
  }, [])

  async function fetchItem() {
    const { data, error } = await supabase.from("store_items").select("*").eq("id", itemId).single()

    if (error) {
      console.error("[v0] Error fetching item:", error)
      toast({
        title: "Error",
        description: "Failed to fetch item",
        variant: "destructive",
      })
      router.push("/admin/store")
    } else if (data) {
      setItem(data as StoreItem)
      setFormData({
        name: data.name,
        cost: data.cost.toString(),
        quantity: data.quantity.toString(),
        type: data.type || "Digital",
        is_available: data.is_available,
        icon: data.icon || "",
        payout_method: data.payout_method || "",
      })
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const patch = {
      name: formData.name,
      cost: Number.parseInt(formData.cost),
      quantity: Number.parseInt(formData.quantity),
      type: formData.type,
      is_available: formData.is_available,
      icon: formData.icon || null,
      // NULL, not "", so the column's CHECK accepts it.
      payout_method: formData.payout_method || null,
      updated_at: new Date().toISOString(),
    }

    let { error } = await supabase.from("store_items").update(patch).eq("id", itemId)

    // payout_method arrives with scripts/057. Before that the column is absent
    // and PostgREST rejects the whole update, so saving anything at all failed.
    if (error?.code === "PGRST204" || error?.code === "42703") {
      const { payout_method: _dropped, ...withoutPayout } = patch
      ;({ error } = await supabase.from("store_items").update(withoutPayout).eq("id", itemId))

      if (!error) {
        toast({
          title: "Saved, but without the payout method",
          description: "Run scripts/057_store_payout_details.sql in Supabase, then set it again.",
          className: "bg-amber-600 text-white",
        })
        router.push("/admin/store")
        setSubmitting(false)
        return
      }
    }

    if (error) {
      console.error("[v0] Error updating item:", error)
      toast({
        title: "Error",
        description: `Failed to update item: ${error.message}`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Item updated successfully",
        className: "bg-green-600 text-white",
      })
      router.push("/admin/store")
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white">Item not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/store">
          <Button variant="ghost" className="text-white/40 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Store
          </Button>
        </Link>

        <div className="bg-white/[0.03] backdrop-blur border border-white/[0.08] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Edit Store Item</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-white/60">
                Item Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-black/40 border-white/[0.10] text-white"
              />
            </div>

            <div>
              <Label htmlFor="cost" className="text-white/60">
                Cost (Points)
              </Label>
              <Input
                id="cost"
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                required
                className="bg-black/40 border-white/[0.10] text-white"
              />
            </div>

            <div>
              <Label htmlFor="type" className="text-white/60">
                Type
              </Label>
              <SelectMenu
                id="type"
                aria-label="Type"
                value={formData.type}
                onChange={(value) => setFormData({ ...formData, type: value })}
                options={[
                    { value: "Digital", label: "Digital" },
                    { value: "Physical", label: "Physical" },
                    { value: "Service", label: "Service" },
                    { value: "Bonus", label: "Bonus" },
                    { value: "Other", label: "Other" },
                  ]}
              />
            </div>

            <div>
              <Label htmlFor="quantity" className="text-white/60">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                className="bg-black/40 border-white/[0.10] text-white"
              />
              <p className="text-xs text-white/40 mt-1">Set to -1 for infinite quantity</p>
            </div>

            <div>
              <Label htmlFor="is_available" className="text-white/60">
                Status
              </Label>
              <SelectMenu
                id="is_available"
                aria-label="Status"
                value={formData.is_available}
                onChange={(value) => setFormData({ ...formData, is_available: value })}
                options={[
                  { value: "true", label: "Enabled" },
                  { value: "false", label: "Disabled" },
                ]}
              />
            </div>

            <PayoutMethodField
              value={formData.payout_method}
              onChange={(value) => setFormData({ ...formData, payout_method: value })}
            />

            <StoreImageField
              value={formData.icon}
              onChange={(value) => setFormData({ ...formData, icon: value })}
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting} className="bg-[#5B8DEF] hover:bg-[#5B8DEF] flex-1">
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Link href="/admin/store" className="flex-1">
                <Button type="button" variant="outline" className="w-full bg-transparent border-white/[0.12]">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
