/**
 * Addresses on the public site, for links that start in the admin panel.
 *
 * With ADMIN_HOST set, the panel lives on its own host (admin.trinidorewards.com)
 * where every path means an admin page: "/bonuses" there is Admin > Bonuses,
 * not the public page, and "/obs/stream" is not an overlay. So a link from the
 * panel to the public site, or an OBS URL copied from it, has to name the main
 * site explicitly. NEXT_PUBLIC_SITE_URL is that address
 * (https://trinidorewards.com); unset, everything stays relative to wherever
 * the page is, which is exactly right while the panel is under /admin.
 */

function base(): string | null {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "")
  return value || null
}

/** For an href: the public page, on the main site. Same on server and client. */
export function siteHref(path: string): string {
  const root = base()
  return root ? `${root}${path}` : path
}

/**
 * An absolute URL, for things copied into another program (OBS needs the full
 * address). Falls back to the current origin when no site address is set.
 */
export function siteUrl(path: string): string {
  const root = base()
  if (root) return `${root}${path}`
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`
}
