"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
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
}

export default function EditStoreItemPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<StoreItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    cost: "",
    quantity: "",
    type: "Digital",
    is_available: "true",
  })
  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchItem()
  }, [])

  async function fetchItem() {
    const { data, error } = await supabase.from("store_items").select("*").eq("id", params.id).single()

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
      })
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const { error } = await supabase
      .from("store_items")
      .update({
        name: formData.name,
        cost: Number.parseInt(formData.cost),
        quantity: Number.parseInt(formData.quantity),
        type: formData.type,
        is_available: formData.is_available,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)

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
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/store">
          <Button variant="ghost" className="text-slate-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Store
          </Button>
        </Link>

        <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Edit Store Item</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-slate-300">
                Item Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="cost" className="text-slate-300">
                Cost (Points)
              </Label>
              <Input
                id="cost"
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="type" className="text-slate-300">
                Type
              </Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                className="w-full h-10 bg-slate-800 border border-slate-700 text-white rounded-md px-3"
              >
                <option value="Digital">Digital</option>
                <option value="Physical">Physical</option>
                <option value="Service">Service</option>
                <option value="Bonus">Bonus</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="quantity" className="text-slate-300">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-400 mt-1">Set to -1 for infinite quantity</p>
            </div>

            <div>
              <Label htmlFor="is_available" className="text-slate-300">
                Status
              </Label>
              <select
                id="is_available"
                value={formData.is_available}
                onChange={(e) => setFormData({ ...formData, is_available: e.target.value })}
                className="w-full h-10 bg-slate-800 border border-slate-700 text-white rounded-md px-3"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting} className="bg-cyan-500 hover:bg-cyan-600 flex-1">
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Link href="/admin/store" className="flex-1">
                <Button type="button" variant="outline" className="w-full bg-transparent border-slate-600">
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
