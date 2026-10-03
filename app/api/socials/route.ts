import { serviceClient } from "@/lib/supabase/service"
import { DEFAULT_SOCIALS, SOCIALS_SETTINGS_KEY, parseSocials } from "@/lib/site-socials"

/**
 * The footer's social links, for every visitor. Read with the service role
 * because settings only exposes three keys to the anon key (scripts/072);
 * only the visible links leave the server. Nothing stored yet means the
 * links the footer always had.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  let links = DEFAULT_SOCIALS
  try {
    const { data } = await serviceClient().from("settings").select("value").eq("key", SOCIALS_SETTINGS_KEY).maybeSingle()
    const parsed = data?.value ? parseSocials(data.value) : null
    if (parsed) links = parsed.links
  } catch (problem) {
    console.error("[socials] read failed, serving the defaults:", problem)
  }
  return Response.json(
    { links: links.filter((link) => link.visible).map(({ platform, url }) => ({ platform, url })) },
    // A minute at the edge: a saved change shows up quickly, a busy page does not hit the database per view.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  )
}
