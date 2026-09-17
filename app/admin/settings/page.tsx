"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { TransactionsPanel } from "@/components/admin/transactions-panel"
import { MonoLabel, Panel, PanelHeader } from "@/components/ui/panel"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [totalGivenAway, setTotalGivenAway] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
      return
    }
    await fetchTotalGivenAway()
    setLoading(false)
  }

  async function fetchTotalGivenAway() {
    const { data, error } = await supabase.from("settings").select("value").eq("key", "total_given_away").maybeSingle()
    if (error) console.error("[v0] Error fetching total given away:", error)
    else if (data) setTotalGivenAway(data.value || "0")
  }

  async function handleUpdateTotalGivenAway(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)

    const { error } = await supabase
      .from("settings")
      .upsert(
        { key: "total_given_away", value: totalGivenAway, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      )

    if (error) {
      console.error("[v0] Error saving total given away:", error)
      toast({ title: "Error", description: "Could not save the total.", variant: "destructive" })
    } else {
      toast({ title: "Saved", description: "Total given away updated.", className: "bg-emerald-600 text-white" })
    }
    setSaving(false)
  }

  if (loading) {
    return <p className="py-16 text-center font-mono text-[11px] uppercase tracking-widest text-white/30">Loading</p>
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-[13px] text-white/40">Money in and out, and the figure shown on the landing page.</p>
      </header>

      {/* Transactions first — it is the panel that actually gets used daily. */}
      <TransactionsPanel />

      <Panel>
        <PanelHeader title="Total given away" accent="purple" />
        <form onSubmit={handleUpdateTotalGivenAway} className="flex flex-wrap items-end gap-2 p-3.5">
          <label className="min-w-48 flex-1">
            <MonoLabel className="block text-white/40">Amount ($)</MonoLabel>
            <input
              type="number"
              step="1"
              min="0"
              value={totalGivenAway}
              onChange={(event) => setTotalGivenAway(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/40 px-3 text-[13px] tabular-nums text-white outline-none transition focus:border-white/25"
              placeholder="0"
            />
            <p className="mt-1.5 text-[11px] text-white/30">Shown in the stats row on the landing page.</p>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-md border border-white/12 bg-white/[0.06] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-white/[0.12] disabled:opacity-50"
          >
            {saving ? "Saving" : "Save"}
          </button>
        </form>
      </Panel>
    </div>
  )
}
