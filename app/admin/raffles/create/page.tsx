"use client"

import type React from "react"

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

export default function CreateRafflePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prize_name: "",
    prize_value: "",
    prize_image_url: "",
    ticket_price: "0",
    entry_type: "free",
    max_tickets: "",
    total_tickets_available: "",
    start_date: "",
    end_date: "",
    draw_date: "",
    status: "upcoming",
    featured: false,
  })

  const supabase = createBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const raffleData = {
      title: formData.title,
      description: formData.description,
      prize_name: formData.prize_name,
      prize_value: formData.prize_value ? Number.parseFloat(formData.prize_value) : null,
      prize_image_url: formData.prize_image_url || null,
      ticket_price: Number.parseInt(formData.ticket_price),
      entry_type: formData.entry_type,
      max_tickets: formData.max_tickets ? Number.parseInt(formData.max_tickets) : null,
      total_tickets_available: formData.total_tickets_available
        ? Number.parseInt(formData.total_tickets_available)
        : null,
      start_date: formData.start_date,
      end_date: formData.end_date,
      draw_date: formData.draw_date || null,
      status: formData.status,
      featured: formData.featured,
    }

    const { error } = await supabase.from("raffles").insert([raffleData])

    if (error) {
      console.error("Error creating raffle:", error)
      alert("Failed to create raffle")
    } else {
      alert("Raffle created successfully!")
      router.push("/admin/raffles/active")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Create Raffle</h1>
          <p className="text-slate-400 mt-1">Create a new raffle campaign</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">Raffle Details</CardTitle>
            <CardDescription>Fill in the raffle information below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-white">
                    Title *
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prize_name" className="text-white">
                    Prize Name *
                  </Label>
                  <Input
                    id="prize_name"
                    value={formData.prize_name}
                    onChange={(e) => setFormData({ ...formData, prize_name: e.target.value })}
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="prize_value" className="text-white">
                    Prize Value ($)
                  </Label>
                  <Input
                    id="prize_value"
                    type="number"
                    step="0.01"
                    value={formData.prize_value}
                    onChange={(e) => setFormData({ ...formData, prize_value: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entry_type" className="text-white">
                    Entry Type *
                  </Label>
                  <Select
                    value={formData.entry_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, entry_type: value, ticket_price: value === "free" ? "0" : "100" })
                    }
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free Entry</SelectItem>
                      <SelectItem value="points">Points Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.entry_type === "points" && (
                <div className="space-y-2">
                  <Label htmlFor="ticket_price" className="text-white">
                    Ticket Price (Points) *
                  </Label>
                  <Input
                    id="ticket_price"
                    type="number"
                    value={formData.ticket_price}
                    onChange={(e) => setFormData({ ...formData, ticket_price: e.target.value })}
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-white">
                    Start Date *
                  </Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-white">
                    End Date *
                  </Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draw_date" className="text-white">
                    Draw Date
                  </Label>
                  <Input
                    id="draw_date"
                    type="datetime-local"
                    value={formData.draw_date}
                    onChange={(e) => setFormData({ ...formData, draw_date: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-white">
                    Status *
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="featured" className="text-white">
                    Featured
                  </Label>
                  <div className="flex items-center space-x-2 h-10">
                    <Switch
                      id="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })}
                    />
                    <Label htmlFor="featured" className="text-slate-400 cursor-pointer">
                      Show as featured raffle
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {loading ? "Creating..." : "Create Raffle"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
