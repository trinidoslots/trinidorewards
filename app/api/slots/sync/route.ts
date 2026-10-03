import { bearerMatches } from "@/lib/bearer"
import { serviceClient } from "@/lib/supabase/service"
import { syncSlotsFromBonushunt } from "@/lib/slots-sync"

/**
 * Daily catalogue sync, run by the Vercel cron in vercel.json: Stake's new
 * slots from bonushunt.gg's public API into the `slots` table (lib/slots-sync).
 *
 * Vercel signs cron requests with CRON_SECRET; without it set the cron is
 * refused rather than left open. Admins run the same sync from /admin/slots
 * through /api/admin/slots/sync.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  if (!bearerMatches(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await syncSlotsFromBonushunt(serviceClient(), "cron")
  return Response.json(result, { status: result.ok ? 200 : 502 })
}
