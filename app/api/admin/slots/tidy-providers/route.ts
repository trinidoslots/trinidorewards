import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { tidyProviders } from "@/lib/slots-tidy"

/**
 * The "Tidy provider names" button on /admin/slots: provider slugs such as
 * "donut-gaming" become "Donut Gaming" across the catalogue (lib/slots-tidy).
 * Every import does the same first, so this is for doing it on demand.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  try {
    const result = await tidyProviders(serviceClient())
    console.log(`[slots] ${auth.email} tidied providers:`, result)
    return Response.json(result)
  } catch (problem) {
    return Response.json({ error: problem instanceof Error ? problem.message : "Could not tidy." }, { status: 500 })
  }
}
