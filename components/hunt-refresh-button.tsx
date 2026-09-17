"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

export function HuntRefreshButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.refresh()}
      className="ml-auto rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white"
      aria-label="Refresh"
    >
      <RefreshCw className="w-4 h-4" />
    </button>
  )
}
