"use client"

import { adminHref } from "@/lib/admin-host"
import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { use, useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { EMPTY_STORE_ITEM, StoreItemForm, type StoreItemValues } from "@/components/admin/store-item-form"

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
  const [formData, setFormData] = useState<StoreItemValues>(EMPTY_STORE_ITEM)
  // Whether the row came back with the column at all (scripts/076). If not,
  // the flag is left out of the save rather than failing it.
  const [hasCodeUserColumn, setHasCodeUserColumn] = useState(false)
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
      router.push(adminHref("/admin/store"))
    } else if (data) {
      setItem(data as StoreItem)
      setFormData({
        name: data.name,
        // Category, description and the one-per-user rule were set at creation
        // and could not be changed afterwards; the shared form edits them too.
        category: data.category || "Regular",
        description: data.description || "",
        cost: data.cost.toString(),
        quantity: data.quantity.toString(),
        type: data.type || "Digital",
        is_available: String(data.is_available) === "false" ? "false" : "true",
        icon: data.icon || "",
        payout_method: data.payout_method || "",
        one_purchase_per_user: data.one_purchase_per_user === true,
        code_user_only: data.code_user_only === true,
      })
      setHasCodeUserColumn("code_user_only" in data)
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const patch = {
      name: formData.name,
      category: formData.category || null,
      description: formData.description || null,
      one_purchase_per_user: formData.one_purchase_per_user,
      cost: Number.parseInt(formData.cost),
      quantity: Number.parseInt(formData.quantity),
      type: formData.type,
      is_available: formData.is_available,
      icon: formData.icon || null,
      // NULL, not "", so the column's CHECK accepts it.
      payout_method: formData.payout_method || null,
      ...(hasCodeUserColumn || formData.code_user_only ? { code_user_only: formData.code_user_only } : {}),
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
        router.push(adminHref("/admin/store"))
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
      router.push(adminHref("/admin/store"))
    }

    setSubmitting(false)
  }

  if (loading || !item) {
    return (
      <p className="py-16 text-center font-mono text-[11px] uppercase tracking-widest text-white/30">
        {loading ? "Loading" : "Item not found"}
      </p>
    )
  }

  return <StoreItemForm mode="edit" values={formData} onChange={setFormData} onSubmit={handleSubmit} submitting={submitting} />
}
