"use client"

import { adminHref } from "@/lib/admin-host"
import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { EMPTY_STORE_ITEM, StoreItemForm, type StoreItemValues } from "@/components/admin/store-item-form"

export default function AddStoreItemPage() {
  const [formData, setFormData] = useState<StoreItemValues>(EMPTY_STORE_ITEM)
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
      // Only sent when set: the column arrives with scripts/076, and an unset
      // flag must not break creating items before that has run.
      ...(formData.code_user_only ? { code_user_only: true } : {}),
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
        router.push(adminHref("/admin/store"))
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
      router.push(adminHref("/admin/store"))
    }

    setSubmitting(false)
  }

  return <StoreItemForm mode="add" values={formData} onChange={setFormData} onSubmit={handleSubmit} submitting={submitting} />
}
