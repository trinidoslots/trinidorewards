"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

type BonusHunt = {
  id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  starting_balance: number | null
  opening_balance: number | null
  created_at: string
}

type Slot = {
  id: string
  game_name: string
  provider: string
}

export default function AdminPage() {
  const router = useRouter()

  useEffect(() => {
    router.push("/admin/users")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white">Redirecting...</p>
    </div>
  )
}
