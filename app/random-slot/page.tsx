"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useRef, useState } from "react"
import { Shuffle } from "lucide-react"

type RandomSlotState = {
  id: number
  is_rolling: boolean
  current_slot_name: string | null
  current_slot_provider: string | null
  final_slot_name: string | null
  final_slot_provider: string | null
  updated_at: string
}

export default function RandomSlotOBS() {
  const [slotState, setSlotState] = useState<RandomSlotState | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRolling, setShowRolling] = useState(false)
  const [showRollingText, setShowRollingText] = useState(false)
  const [transitionPhase, setTransitionPhase] = useState<"fadeOut" | "fadeIn" | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const supabase = createClient()
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const animationFrameRef = useRef<number>(0)

  function setTimer(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }

  function clearAllTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }

  async function fetchSlotState() {
    const { data, error } = await supabase.from("random_slot_state").select("*").eq("id", 1).single()
    if (error) {
      console.error("[v0] Error fetching random slot state:", error)
      return
    }
    setSlotState(data as RandomSlotState)
    setLoading(false)
  }

  // Smooth transition between states
  useEffect(() => {
    clearAllTimers()

    // START rolling
    if (slotState?.is_rolling) {
      if (!showRolling) {
        setTransitionPhase("fadeOut")
        
        // Use RAF for smooth expansion
        animationFrameRef.current = requestAnimationFrame(() => {
          setIsExpanded(true)
        })

        setTimer(() => {
          setShowRolling(true)
          setShowRollingText(true)
          setTransitionPhase("fadeIn")
        }, 500)

        setTimer(() => {
          setTransitionPhase(null)
        }, 1000)
      }
      return
    }

    // STOP rolling
    if (!slotState?.is_rolling && showRolling) {
      // Hide "Rolling..." text immediately
      setShowRollingText(false)
      
      setTransitionPhase("fadeOut")
      
      animationFrameRef.current = requestAnimationFrame(() => {
        setIsExpanded(false)
      })

      setTimer(() => {
        setShowRolling(false)
        setTransitionPhase("fadeIn")
      }, 500)

      setTimer(() => {
        setTransitionPhase(null)
      }, 1000)
      
      return
    }

    setTransitionPhase(null)
  }, [slotState?.is_rolling])

  // Reset after 20s
  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | null = null

    if (!slotState?.is_rolling && slotState?.final_slot_name) {
      resetTimer = setTimer(async () => {
        setTransitionPhase("fadeOut")
        setIsExpanded(false)

        setTimer(async () => {
          try {
            await supabase
              .from("random_slot_state")
              .update({
                final_slot_name: null,
                final_slot_provider: null,
                current_slot_name: null,
                current_slot_provider: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", 1)
          } catch (e) {
            console.error("error resetting random_slot_state", e)
          } finally {
            setTransitionPhase("fadeIn")
            setTimer(() => {
              setTransitionPhase(null)
            }, 500)
          }
        }, 500)
      }, 10000)
    }

    return () => {
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [slotState?.is_rolling, slotState?.final_slot_name])

  // Polling + realtime sync - optimized
  useEffect(() => {
    fetchSlotState()
    const pollInterval = setInterval(fetchSlotState, 10)
    const channel = supabase
      .channel("random_slot_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "random_slot_state" }, fetchSlotState)
      .subscribe()

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
      clearAllTimers()
    }
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-transparent flex items-center justify-center text-white">Loading...</div>
  }

  const displaySlot = showRolling
    ? {
        name: slotState?.current_slot_name || "",
        provider: slotState?.current_slot_provider || "",
      }
    : {
        name: slotState?.final_slot_name || "Ready",
        provider: slotState?.final_slot_provider || "Press Generate",
      }

  const fadeClass =
    transitionPhase === "fadeOut"
      ? "opacity-0 scale-95"
      : transitionPhase === "fadeIn"
      ? "opacity-100 scale-100"
      : "opacity-100 scale-100"

  return (
    <div className="min-h-screen bg-transparent p-4 flex items-center justify-center">
      <div className="w-[320px] bg-gradient-to-b from-[#1A1F2B]/95 to-[#0B0E13]/95 backdrop-blur-sm rounded-xl shadow-2xl border border-[#4D84FF]/30 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4D84FF]/20 to-[#7FB3FF]/20 px-5 py-3 border-b border-[#4D84FF]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shuffle className="w-6 h-6 text-[#7FB3FF]" />
            
            <h1 className="text-white font-bold text-xl">RANDOM SLOT</h1>
          </div>
          
        </div>

        {/* Slot Display */}
        <div
          className={`px-5 py-3 space-y-2 transition-all duration-500 ease-out will-change-[min-height] ${
            isExpanded ? "min-h-[140px]" : "min-h-[100px]"
          }`}
        >
          <div
            className={`text-center space-y-2 transform transition-all duration-500 ease-out will-change-[opacity,transform] ${fadeClass} ${
              showRolling ? "animate-pulse" : ""
            }`}
          >
            <div className="text-xl font-bold text-white px-2 py-2 truncate">{displaySlot.name}</div>
            <div className="text-base text-[#7FB3FF] font-semibold">{displaySlot.provider}</div>
            {showRolling && showRollingText && <div className="text-sm text-gray-400 animate-pulse">Rolling...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
