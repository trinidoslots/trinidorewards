import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { lastSlotSync, syncSlotsFromBonushunt } from "@/lib/slots-sync"

/**
 * The daily bonushunt.gg slot sync, from /admin/slots.
 *
 * GET  — the last run (cron or by hand): when, what it found, what was new.
 * POST — run it now.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  return Response.json({ last: await lastSlotSync(serviceClient()) })
}

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const result = await syncSlotsFromBonushunt(serviceClient(), "admin")
  console.log(`[slots-sync] run by ${auth.email}`)
  return Response.json(result, { status: result.ok ? 200 : 502 })
}
