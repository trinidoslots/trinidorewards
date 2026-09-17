"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import { createHunt } from "@/app/actions/hunt-actions"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export function NewHuntDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const result = await createHunt(formData)

      if (result.success) {
        toast({
          title: "Hunt Created",
          description: "Your bonus hunt has been started!",
        })
        setOpen(false)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create hunt",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cyan-600 hover:bg-cyan-500 text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Hunt
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Start New Bonus Hunt</DialogTitle>
          <DialogDescription className="text-slate-400">Track your casino bonus hunt progress</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="casino">Casino</Label>
            <Input
              id="casino"
              name="casino"
              placeholder="e.g., Stake, Roobet"
              required
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label htmlFor="slot">Slot Game</Label>
            <Input
              id="slot"
              name="slot"
              placeholder="e.g., Gates of Olympus"
              required
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_balance">Start Balance ($)</Label>
              <Input
                id="start_balance"
                name="start_balance"
                type="number"
                step="0.01"
                placeholder="100.00"
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="target_balance">Target Balance ($)</Label>
              <Input
                id="target_balance"
                name="target_balance"
                type="number"
                step="0.01"
                placeholder="200.00"
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="max_bet">Max Bet ($)</Label>
            <Input
              id="max_bet"
              name="max_bet"
              type="number"
              step="0.01"
              placeholder="5.00"
              required
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500">
            {loading ? "Creating..." : "Start Hunt"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
