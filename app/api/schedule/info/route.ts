import { NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"
import { readScheduleInfo, SCHEDULE_INFO_KEY } from "@/lib/schedule-info"

/**
 * The info text shown above the schedule, written in Admin > Schedule.
 *
 * Kept in `settings` under schedule_info. That table only lets visitors read a
 * few named keys (scripts/072), so this is read here with the server's client
 * instead of widening the policy for one more key.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { data } = await serviceClient().from("settings").select("value").eq("key", SCHEDULE_INFO_KEY).maybeSingle()
    return NextResponse.json({ info: readScheduleInfo(data?.value) })
  } catch {
    return NextResponse.json({ info: null })
  }
}
