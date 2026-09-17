"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel } from "@/components/ui/panel"
import { RaffleForm, emptyDraft, toLocalInput, type RaffleDraft } from "@/components/admin/raffle-form"

export default function EditRafflePage() {
  const params = useParams()
  const raffleId = params.id as string

  const [draft, setDraft] = useState<RaffleDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: problem } = await createBrowserClient()
        .from("raffles")
        .select("*")
        .eq("id", raffleId)
        .maybeSingle()

      if (cancelled) return
      if (problem || !data) {
        setError(problem?.message || "That raffle does not exist")
        return
      }

      setDraft({
        ...emptyDraft,
        title: data.title ?? "",
        description: data.description ?? "",
        prize_name: data.prize_name ?? "",
        prize_value: data.prize_value == null ? "" : String(data.prize_value),
        prize_image_url: data.prize_image_url ?? "",
        ticket_price: String(data.ticket_price ?? 0),
        entry_type: data.entry_type ?? (Number(data.ticket_price) === 0 ? "free" : "paid"),
        max_tickets: data.max_tickets == null ? "" : String(data.max_tickets),
        total_tickets_available:
          data.total_tickets_available == null ? "" : String(data.total_tickets_available),
        // Stored as instants, shown in the browser's own time.
        start_date: toLocalInput(data.start_date),
        end_date: toLocalInput(data.end_date),
        draw_date: toLocalInput(data.draw_date),
        featured: !!data.featured,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [raffleId])

  if (error) {
    return (
      <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
        {error}
      </Panel>
    )
  }

  if (!draft) {
    return (
      <Panel className="py-16 text-center">
        <MonoLabel className="text-white/25">Loading</MonoLabel>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">Edit raffle</h1>
        <p className="mt-1 text-[13px] text-white/40">{draft.title}</p>
      </header>
      <RaffleForm raffleId={raffleId} initial={draft} />
    </div>
  )
}
