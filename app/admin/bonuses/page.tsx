"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit2, Trash2, Gift, Star } from "lucide-react"

interface Bonus {
  id: string
  title: string
  description: string | null
  code: string | null
  terms: string | null
  value: string | null
  casino_name: string | null
  casino_url: string | null
  image_url: string | null
  is_active: boolean
  featured: boolean
  created_at: string
}

export default function AdminBonusesPage() {
  const [bonuses, setBonuses] = useState<Bonus[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    code: "",
    terms: "",
    value: "",
    casino_name: "",
    casino_url: "",
    image_url: "",
    is_active: true,
    featured: false,
  })
  const { toast } = useToast()
  const supabase = createBrowserClient()

  useEffect(() => {
    fetchBonuses()
  }, [])

  async function fetchBonuses() {
    const { data, error } = await supabase.from("bonuses").select("*").order("created_at", { ascending: false })

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch bonuses",
        variant: "destructive",
      })
      return
    }

    setBonuses(data || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (editingId) {
      const { error } = await supabase
        .from("bonuses")
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId)

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update bonus",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Bonus updated successfully",
      })
    } else {
      const { error } = await supabase.from("bonuses").insert([formData])

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create bonus",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Bonus created successfully",
      })
    }

    resetForm()
    fetchBonuses()
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this bonus?")) return

    const { error } = await supabase.from("bonuses").delete().eq("id", id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete bonus",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Success",
      description: "Bonus deleted successfully",
    })
    fetchBonuses()
  }

  function handleEdit(bonus: Bonus) {
    setEditingId(bonus.id)
    setFormData({
      title: bonus.title,
      description: bonus.description ?? "",
      code: bonus.code ?? "",
      terms: bonus.terms ?? "",
      value: bonus.value ?? "",
      casino_name: bonus.casino_name ?? "",
      casino_url: bonus.casino_url ?? "",
      image_url: bonus.image_url ?? "",
      is_active: bonus.is_active,
      featured: bonus.featured,
    })
  }

  function resetForm() {
    setEditingId(null)
    setFormData({
      title: "",
      description: "",
      code: "",
      terms: "",
      value: "",
      casino_name: "",
      casino_url: "",
      image_url: "",
      is_active: true,
      featured: false,
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-400 text-sm">Loading bonuses...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Gift className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Bonuses</h1>
          <p className="text-slate-400 text-sm">Create and manage bonus offers</p>
        </div>
      </div>

      {/* Add/Edit Form */}
      <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white text-base">{editingId ? "Edit Bonus" : "Add New Bonus"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="casino_name" className="text-slate-300 text-xs">
                  Casino Name
                </Label>
                <Input
                  id="casino_name"
                  value={formData.casino_name}
                  onChange={(e) => setFormData({ ...formData, casino_name: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm h-8"
                  placeholder="e.g., Stake Casino"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-300 text-xs">
                  Bonus Title *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm h-8"
                  placeholder="e.g., Welcome Bonus"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="value" className="text-slate-300 text-xs">
                  Bonus Value
                </Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm h-8"
                  placeholder="e.g., 100% up to $500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300 text-xs">
                  Bonus Code
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm h-8"
                  placeholder="e.g., WELCOME100"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description" className="text-slate-300 text-xs">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm min-h-[60px]"
                  placeholder="Describe the bonus offer..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="terms" className="text-slate-300 text-xs">
                  Terms & Conditions
                </Label>
                <Textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm min-h-[60px]"
                  placeholder="e.g., 40x wagering requirement, 18+"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="casino_url" className="text-slate-300 text-xs">
                  Casino URL
                </Label>
                <Input
                  id="casino_url"
                  type="url"
                  value={formData.casino_url}
                  onChange={(e) => setFormData({ ...formData, casino_url: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm h-8"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url" className="text-slate-300 text-xs">
                  Image URL
                </Label>
                <Input
                  id="image_url"
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white text-sm h-8"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-600"
                  />
                  <span className="text-slate-300 text-xs">Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-600 focus:ring-amber-600"
                  />
                  <span className="text-slate-300 text-xs flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Featured
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white h-8 text-xs"
              >
                {editingId ? "Update Bonus" : "Add Bonus"}
                <Plus className="w-3 h-3 ml-1" />
              </Button>
              {editingId && (
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs bg-transparent"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Bonuses List */}
      <Card className="bg-slate-900/60 backdrop-blur border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white text-base">All Bonuses ({bonuses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {bonuses.length === 0 ? (
            <p className="text-slate-400 text-center py-6 text-xs">No bonuses created yet</p>
          ) : (
            <div className="space-y-3">
              {bonuses.map((bonus) => (
                <div
                  key={bonus.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {bonus.featured && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      <h3 className="text-white font-medium text-sm truncate">
                        {bonus.casino_name && `${bonus.casino_name} - `}
                        {bonus.title}
                      </h3>
                      {!bonus.is_active && <span className="text-slate-500 text-xs">(Inactive)</span>}
                    </div>
                    {bonus.value && <p className="text-cyan-400 text-xs font-medium mb-1">{bonus.value}</p>}
                    {bonus.description && <p className="text-slate-400 text-xs line-clamp-2">{bonus.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      onClick={() => handleEdit(bonus)}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-cyan-400 hover:bg-slate-700"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(bonus.id)}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-slate-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
