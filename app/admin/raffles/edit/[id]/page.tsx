import { createServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import RaffleEditForm from "@/components/raffle-edit-form"

export default async function EditRafflePage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient()

  const { data: raffle, error } = await supabase.from("raffles").select("*").eq("id", params.id).single()

  if (error || !raffle) {
    notFound()
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Edit Raffle</h1>
        <p className="text-white/40">Update raffle details and settings</p>
      </div>

      <RaffleEditForm raffle={raffle} />
    </div>
  )
}
