"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

export function HuntRefreshButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.refresh()}
      className="ml-auto p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-colors"
      aria-label="Refresh"
    >
      <RefreshCw className="w-4 h-4" />
    </button>
  )
}
