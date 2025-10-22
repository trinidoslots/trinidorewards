"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { Coins, ChevronRight, ChevronLeft, Receipt, BanknoteArrowUp, BanknoteArrowDown } from "lucide-react"


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

  return (
    <div className="min-h-screen bg-transparent p-4">
      <div className="w-[320px] bg-gradient-to-b from-[#1A1F2B]/95 to-[#0B0E13]/95 backdrop-blur-sm rounded-xl shadow-2xl border border-[#4D84FF]/30 overflow-hidden">
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
            <BanknoteArrowUp className="w-6 h-6 text-[#7FB3FF]" />
            <span className="text-[#7FB3FF] text-base">Deposit:</span>
            
           </div>
           <div className="flex items-center gap-2">
            <BanknoteArrowDown className="w-6 h-6 text-[#7FB3FF]" />
            <span className="text-[#7FB3FF] text-base">Withdraw:</span>

           </div>

          </div>
          <div className="flex justify-between">
            <span className="text-red-400 font-bold text-xl">-${depositAmount.toLocaleString()}</span>
            <span className="text-emerald-400 font-bold text-xl">+${withdrawAmount.toLocaleString()}</span>
            
          </div>
        </div>
    </div>
    </div>
  )
}
