"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { Receipt } from "lucide-react"
import { AnimatedAmount } from "@/components/animated-amount"

export default function DepositsWithdrawalsWidget() {
  const [depositAmount, setDepositAmount] = useState(0)
  const [withdrawAmount, setWithdrawAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function fetchDepositsWithdrawals() {
    const { data, error } = await supabase.from("deposits_withdrawals").select("*").limit(1).single()

    if (error) {
      console.error("[v0] Error fetching deposits/withdrawals:", error)
    } else if (data) {
      setDepositAmount(Number(data.deposit_amount) || 0)
      setWithdrawAmount(Number(data.withdraw_amount) || 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDepositsWithdrawals()

    // Poll every second for updates
    const pollInterval = setInterval(() => {
      fetchDepositsWithdrawals()
    }, 1000)

    // Subscribe to real-time changes
    const channel = supabase
      .channel("deposits_withdrawals_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits_withdrawals" }, () =>
        fetchDepositsWithdrawals(),
      )
      .subscribe()

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-transparent flex items-center justify-center text-white">Loading...</div>
  }

  // Data URLs with stroke set to the exact Tailwind hex values:
  // red-400:   #fb7185
  // emerald-400: #34D399
  const banknoteArrowDown =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmYjcxODUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLXdpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTEgMThINGEyIDIgMCAwIDEtMi0yVjhhMiAyIDAgMCAxIDItMmgxNmEyIDIgMCAwIDEgMiAydjUiLz48cGF0aCBkPSJtMTYgMTkgMyAzIDMtMyIvPjxwYXRoIGQ9Ik0xOCAxMmguMDEiLz48cGF0aCBkPSJNM" +
    "TkgMTZ2NiIvPjxwYXRoIGQ9Ik02IDEyIGguMDEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIyIi8+PC9zdmc+"

  const banknoteArrowUp =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzNEQzOTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLXdpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTEgMThINGEyIDIgMCAwIDEtMi0yVjhhMiAyIDAgMCAxIDItMmgxNmEyIDIgMCAwIDEgMiAydjUiLz48cGF0aCBkPSJtMTggMTJoLjAxIi8+PHBhdGggZD0iTTE5IDIydi02Ii8+PHBhdGggZD0ibTIyIDE5LTMtMy0zIDMiLz48cGF0aCBkPSJNNiAxMmguMDEiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIyIi8+PC9zdmc+"

  return (
    <div className="min-h-screen bg-transparent p-4">
      <div className="w-[320px] bg-gradient-to-b from-[#1A1F2B]/95 to-[#0B0E13]/95 backdrop-blur-sm rounded-xl shadow-2xl border border-[#4D84FF]/30 overflow-hidden relative">
        {/* Background accents */}
        <div
          className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 120% 80% at 0% 100%, rgba(239, 68, 68, 0.08) 0%, transparent 25%),
              radial-gradient(ellipse 80% 120% at 10% 90%, rgba(220, 38, 38, 0.06) 0%, transparent 30%),
              radial-gradient(circle at 5% 95%, rgba(239, 68, 68, 0.05) 0%, transparent 20%)
            `,
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-64 h-64 pointer-events-none opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 120% 80% at 100% 100%, rgba(34, 197, 94, 0.08) 0%, transparent 25%),
              radial-gradient(ellipse 80% 120% at 90% 90%, rgba(22, 163, 74, 0.06) 0%, transparent 30%),
              radial-gradient(circle at 95% 95%, rgba(34, 197, 94, 0.05) 0%, transparent 20%)
            `,
          }}
        />

        {/* Header */}
        <div className="bg-gradient-to-r from-[#4D84FF]/20 to-[#7FB3FF]/20 px-5 py-3 border-b border-[#4D84FF]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#7FB3FF]" />
            <h1 className="text-white font-bold text-xl">TRANSACTIONS</h1>
          </div>
        </div>

        {/* Transactions */}
        <div className="px-5 py-3 space-y-2 text-base border-b border-[#4D84FF]/20">
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <img src={banknoteArrowDown} alt="Deposit" className="w-6 h-6" />
              <span className="text-[#7FB3FF] text-base">Deposit:</span>
            </div>
            <div className="flex items-center gap-2">
              <img src={banknoteArrowUp} alt="Withdraw" className="w-6 h-6" />
              <span className="text-[#7FB3FF] text-base">Withdraw:</span>
            </div>
          </div>
          <div className="flex justify-between">
            <AnimatedAmount value={depositAmount} sign="-" className="text-red-400 font-bold text-xl" />
            <AnimatedAmount value={withdrawAmount} sign="+" className="text-emerald-400 font-bold text-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
