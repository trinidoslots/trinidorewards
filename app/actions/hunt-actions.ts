"use server"

import { serviceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { getSiteSession } from "@/lib/site-session"

export async function createHunt(formData: FormData) {
  try {
    const supabase = serviceClient()
    const cookieStore = await cookies()
    const username = (await getSiteSession())?.username

    if (!username) {
      return { success: false, error: "Not authenticated" }
    }

    const casino = formData.get("casino") as string
    const slot = formData.get("slot") as string
    const startBalance = Number.parseFloat(formData.get("start_balance") as string)
    const targetBalance = Number.parseFloat(formData.get("target_balance") as string)
    const maxBet = Number.parseFloat(formData.get("max_bet") as string)

    const { error } = await supabase.from("hunts").insert({
      user_id: username,
      casino,
      slot,
      start_balance: startBalance,
      target_balance: targetBalance,
      current_balance: startBalance,
      max_bet: maxBet,
      status: "active",
      start_time: new Date().toISOString(),
      bonus_hit: false,
    })

    if (error) {
      console.error("[v0] Error creating hunt:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/hunts")
    return { success: true }
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function updateBalance(formData: FormData) {
  try {
    const supabase = serviceClient()
    // Signed in, and only your own hunt: these ran unchecked before, so any
    // visitor could change anyone's hunt by id.
    const owner = (await getSiteSession())?.username
    if (!owner) return { success: false, error: "Not authenticated" }
    const huntId = formData.get("huntId") as string
    const newBalance = Number.parseFloat(formData.get("new_balance") as string)

    const { error } = await supabase
      .from("hunts")
      .update({
        current_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", huntId)
      .eq("user_id", owner)

    if (error) {
      console.error("[v0] Error updating balance:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/hunts")
    return { success: true }
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function recordBonus(formData: FormData) {
  try {
    const supabase = serviceClient()
    // Signed in, and only your own hunt: these ran unchecked before, so any
    // visitor could change anyone's hunt by id.
    const owner = (await getSiteSession())?.username
    if (!owner) return { success: false, error: "Not authenticated" }
    const huntId = formData.get("huntId") as string
    const bonusDetails = formData.get("bonus_details") as string

    const { error } = await supabase
      .from("hunts")
      .update({
        bonus_hit: true,
        bonus_details: bonusDetails || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", huntId)
      .eq("user_id", owner)

    if (error) {
      console.error("[v0] Error recording bonus:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/hunts")
    return { success: true }
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function completeHunt(huntId: string) {
  try {
    const supabase = serviceClient()
    // Signed in, and only your own hunt: these ran unchecked before, so any
    // visitor could change anyone's hunt by id.
    const owner = (await getSiteSession())?.username
    if (!owner) return { success: false, error: "Not authenticated" }

    const { error } = await supabase
      .from("hunts")
      .update({
        status: "completed",
        end_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", huntId)
      .eq("user_id", owner)

    if (error) {
      console.error("[v0] Error completing hunt:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/hunts")
    return { success: true }
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
