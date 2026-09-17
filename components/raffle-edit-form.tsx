"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"

interface Raffle {
  id: string
  title: string
  description: string | null
  image_url: string | null
  ticket_price: number
  max_winners: number
  entry_type: string
  status: string
  start_date: string
  end_date: string
}

export default function RaffleEditForm({ raffle }: { raffle: Raffle }) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: raffle.title || "",
    description: raffle.description || "",
    image_url: raffle.image_url || "",
    ticket_price: raffle.ticket_price?.toString() || "0",
    max_winners: raffle.max_winners?.toString() || "1",
    entry_type: raffle.entry_type || "points",
    status: raffle.status || "active",
    start_date: raffle.start_date ? raffle.start_date.slice(0, 16) : "",
    end_date: raffle.end_date ? raffle.end_date.slice(0, 16) : "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from("raffles")
        .update({
          title: formData.title,
          description: formData.description || null,
          image_url: formData.image_url || null,
          ticket_price: Number.parseFloat(formData.ticket_price) || 0,
          max_winners: Number.parseInt(formData.max_winners) || 1,
          entry_type: formData.entry_type,
          status: formData.status,
          start_date: formData.start_date,
          end_date: formData.end_date,
        })
        .eq("id", raffle.id)

      if (error) throw error

      alert("Raffle updated successfully!")

      router.push("/admin/raffles/active")
      router.refresh()

      setTimeout(() => {
        window.location.href = "/admin/raffles/active"
      }, 100)
    } catch (error) {
      console.error("Error updating raffle:", error)
      alert("Failed to update raffle")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 p-6">
      <Button onClick={() => router.back()} variant="outline" className="mb-6 border-slate-700 hover:bg-slate-700">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-white">
              Raffle Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-slate-900 border-slate-700 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry_type" className="text-white">
              Entry Type
            </Label>
            <Select
              value={formData.entry_type}
              onValueChange={(value) => setFormData({ ...formData, entry_type: value })}
            >
              <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="points">Points</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket_price" className="text-white">
              Ticket Price (Points)
            </Label>
            <Input
              id="ticket_price"
              type="number"
              step="0.01"
              value={formData.ticket_price}
              onChange={(e) => setFormData({ ...formData, ticket_price: e.target.value })}
              className="bg-slate-900 border-slate-700 text-white"
              disabled={formData.entry_type === "free"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_winners" className="text-white">
              Number of Winners
            </Label>
            <Input
              id="max_winners"
              type="number"
              value={formData.max_winners}
              onChange={(e) => setFormData({ ...formData, max_winners: e.target.value })}
              className="bg-slate-900 border-slate-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-white">
              Status
            </Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
                <SelectItem value="drawn">Drawn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url" className="text-white">
              Image URL
            </Label>
            <Input
              id="image_url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://..."
              className="bg-slate-900 border-slate-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date" className="text-white">
              Start Date *
            </Label>
            <Input
              id="start_date"
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="bg-slate-900 border-slate-700 text-white"
              required
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
              className="bg-slate-900 border-slate-700 text-white"
              required
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
            className="bg-slate-900 border-slate-700 text-white min-h-[100px]"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
        >
          {loading ? "Updating..." : "Update Raffle"}
        </Button>
      </form>
    </Card>
  )
}
