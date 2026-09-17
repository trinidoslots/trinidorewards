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
import { Textarea } from "@/components/ui/textarea"
import { DollarSign, Sparkles, CheckCircle2 } from "lucide-react"
import { updateBalance, recordBonus, completeHunt } from "@/app/actions/hunt-actions"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

type HuntActionsProps = {
  huntId: string
  currentBalance: number
  bonusHit: boolean
}

export function HuntActions({ huntId, currentBalance, bonusHit }: HuntActionsProps) {
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [bonusOpen, setBonusOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleUpdateBalance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.append("huntId", huntId)

    try {
      const result = await updateBalance(formData)

      if (result.success) {
        toast({
          title: "Balance Updated",
          description: "Your current balance has been updated!",
        })
        setBalanceOpen(false)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update balance",
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

  async function handleRecordBonus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.append("huntId", huntId)

    try {
      const result = await recordBonus(formData)

      if (result.success) {
        toast({
          title: "Bonus Recorded",
          description: "Your bonus hit has been recorded!",
        })
        setBonusOpen(false)
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to record bonus",
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

  async function handleCompleteHunt() {
    if (!confirm("Are you sure you want to complete this hunt?")) return

    setLoading(true)

    try {
      const result = await completeHunt(huntId)

      if (result.success) {
        toast({
          title: "Hunt Completed",
          description: "Your bonus hunt has been marked as completed!",
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to complete hunt",
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
    <div className="flex gap-2">
      {/* Update Balance Dialog */}
      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="flex-1 bg-slate-800 border-slate-700 hover:bg-slate-700">
            <DollarSign className="w-4 h-4 mr-1" />
            Update Balance
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Update Current Balance</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter your current balance to track progress
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateBalance} className="space-y-4">
            <div>
              <Label htmlFor="new_balance">Current Balance ($)</Label>
              <Input
                id="new_balance"
                name="new_balance"
                type="number"
                step="0.01"
                defaultValue={currentBalance}
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500">
              {loading ? "Updating..." : "Update Balance"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Bonus Dialog */}
      {!bonusHit && (
        <Dialog open={bonusOpen} onOpenChange={setBonusOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 bg-slate-800 border-slate-700 hover:bg-slate-700">
              <Sparkles className="w-4 h-4 mr-1" />
              Hit Bonus
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Record Bonus Hit</DialogTitle>
              <DialogDescription className="text-slate-400">
                Congratulations! Record details about your bonus
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecordBonus} className="space-y-4">
              <div>
                <Label htmlFor="bonus_details">Bonus Details (Optional)</Label>
                <Textarea
                  id="bonus_details"
                  name="bonus_details"
                  placeholder="e.g., 15 free spins, 200x multiplier"
                  className="bg-slate-800 border-slate-700 text-white"
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500">
                {loading ? "Recording..." : "Record Bonus"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Complete Hunt Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCompleteHunt}
        disabled={loading}
        className="flex-1 bg-green-600/20 border-green-500/30 hover:bg-green-600/30 text-green-400"
      >
        <CheckCircle2 className="w-4 h-4 mr-1" />
        Complete
      </Button>
    </div>
  )
}
