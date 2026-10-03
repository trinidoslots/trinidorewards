import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import { DEFAULT_SOCIALS, SOCIALS_SETTINGS_KEY, parseSocials } from "@/lib/site-socials"

/**
 * The footer socials editor on /admin/settings.
 *
 * GET — the full list, hidden ones included (defaults until first saved).
 * PUT — { links: [{ platform, url, visible }] } replaces it. Unknown
 *       platforms and non-https URLs are refused rather than stored.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { data } = await serviceClient().from("settings").select("value").eq("key", SOCIALS_SETTINGS_KEY).maybeSingle()
  const parsed = data?.value ? parseSocials(data.value) : null
  return Response.json({ links: parsed ? parsed.links : DEFAULT_SOCIALS, saved: Boolean(parsed) })
}

export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = parseSocials(body?.links)
  if (!parsed) return Response.json({ error: "Expected { links: [...] }" }, { status: 400 })
  if (parsed.dropped > 0) {
    return Response.json(
      { error: `${parsed.dropped} link${parsed.dropped === 1 ? " has" : "s have"} no valid https address.` },
      { status: 400 },
    )
  }

  const { error } = await serviceClient()
    .from("settings")
    .upsert(
      { key: SOCIALS_SETTINGS_KEY, value: JSON.stringify(parsed.links), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
  if (error) {
    console.error("[socials] save failed:", error)
    return Response.json({ error: "Could not save the links." }, { status: 500 })
  }
  console.log(`[socials] ${auth.email} saved ${parsed.links.length} footer links`)
  return Response.json({ links: parsed.links })
}
