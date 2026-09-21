"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PayoutMethodField, StoreImageField } from "@/components/admin/store-item-fields"

export default function AddStoreItemPage() {
  const [formData, setFormData] = useState({
    name: "",
    category: "Regular",
    description: "",
    icon: "",
    cost: "",
    quantity: "",
    type: "Digital",
    payout_method: "onsite_tip",
    one_purchase_per_user: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const itemData = {
      name: formData.name,
      description: formData.description || null,
      cost: Number.parseInt(formData.cost),
      icon: formData.icon || null,
      category: formData.category || null,
      type: formData.type,
      quantity: Number.parseInt(formData.quantity),
      is_available: "true",
      // NULL rather than "" so the column's CHECK accepts it and the buy
      // dialog reads it as "nothing to ask for".
      payout_method: formData.payout_method || null,
      one_purchase_per_user: formData.one_purchase_per_user,
    }

    let { error } = await supabase.from("store_items").insert([itemData])

    // payout_method arrives with scripts/057. Until that has been run the column
    // does not exist, and PostgREST rejects the whole insert rather than the one
    // unknown field — which made creating any item at all fail. Same fallback
    // the Kick callback uses for users.avatar_url.
    const columnMissing = error?.code === "PGRST204" || error?.code === "42703"

    if (columnMissing) {
      const { payout_method: _dropped, ...withoutPayout } = itemData
      ;({ error } = await supabase.from("store_items").insert([withoutPayout]))

      if (!error) {
        toast({
          title: "Created, but without the payout method",
          description: "Run scripts/057_store_payout_details.sql in Supabase, then set it on the item.",
          className: "bg-amber-600 text-white",
        })
        router.push("/admin/store")
        setSubmitting(false)
        return
      }
    }

    if (error) {
      console.error("[v0] Error creating item:", error)
      toast({
        title: "Error",
        description: `Failed to create item: ${error.message}`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Item created successfully",
        className: "bg-green-600 text-white",
      })
      router.push("/admin/store")
    }

    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin/store">
          <Button variant="ghost" className="text-white/40 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Store
          </Button>
        </Link>

        <div className="bg-white/[0.03] backdrop-blur border border-white/[0.08] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Add Store Item</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Meta Section */}
            <div>
              <h2 className="text-white text-lg font-semibold mb-4">Meta</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-white/60">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-white/[0.06] border-white/[0.10] text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="category" className="text-white/60">
                    Category
                  </Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-10 bg-white/[0.06] border border-white/[0.10] text-white rounded-md px-3"
                  >
                    <option value="Regular">Regular</option>
                    <option value="Premium">Premium</option>
                    <option value="Limited">Limited</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <Label htmlFor="type" className="text-white/60">
                  Type
                </Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                  className="w-full h-10 bg-white/[0.06] border border-white/[0.10] text-white rounded-md px-3"
                >
                  <option value="Digital">Digital</option>
                  <option value="Physical">Physical</option>
                  <option value="Service">Service</option>
                  <option value="Bonus">Bonus</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="mt-4">
                <PayoutMethodField
                  value={formData.payout_method}
                  onChange={(value) => setFormData({ ...formData, payout_method: value })}
                />
              </div>

              <div className="mt-4">
                <StoreImageField
                  value={formData.icon}
                  onChange={(value) => setFormData({ ...formData, icon: value })}
                />
              </div>

              <div className="mt-4">
                <Label htmlFor="description" className="text-white/60">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white/[0.06] border-white/[0.10] text-white min-h-[100px]"
                />
              </div>
            </div>

            {/* Price Section */}
            <div>
              <h2 className="text-white text-lg font-semibold mb-4">Price</h2>
              <div className="grid grid-cols-2 gap-4">
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
                    className="bg-white/[0.06] border-white/[0.10] text-white"
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
                    className="bg-white/[0.06] border-white/[0.10] text-white"
                    placeholder="-1 for infinite"
                  />
                  <p className="text-xs text-white/40 mt-1">Set to -1 for infinite quantity</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="one_purchase"
                  checked={formData.one_purchase_per_user}
                  onChange={(e) => setFormData({ ...formData, one_purchase_per_user: e.target.checked })}
                  className="rounded border-white/[0.12]"
                />
                <Label htmlFor="one_purchase" className="text-white/60 cursor-pointer">
                  One purchase per user
                </Label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting} className="bg-[#5B8DEF] hover:bg-[#5B8DEF] flex-1">
                {submitting ? "Creating..." : "Create Item"}
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
