"use client"

import { RaffleForm } from "@/components/admin/raffle-form"

export default function CreateRafflePage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">New raffle</h1>
        <p className="mt-1 text-[13px] text-white/40">It goes live the moment you save it.</p>
      </header>
      <RaffleForm />
    </div>
  )
}
