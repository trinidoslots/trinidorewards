/**
 * Where a request lands, once the hostname has had its say.
 *
 * The admin panel can be reached two ways: trinidorewards.com/admin, or the
 * dedicated host admin.trinidorewards.com, where the /admin prefix is implied.
 * Set ADMIN_HOST to switch the second one on; until it is set, resolve() is
 * the identity function and nothing about the site changes.
 *
 * Worth being plain about: the subdomain is an address, not a lock. It
 * protects nothing on its own — the session check in the middleware is what
 * does, and it runs on the resolved path, so both hosts are guarded alike.
 *
 * Kept free of next/server so it can be tested on its own.
 */

/** Paths that mean the same thing on every host and must never be rewritten. */
export function isInfrastructure(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  )
}

/**
 * What the admin host means by a path.
 *
 * "/" is the panel's root and "/users" its users page. "/admin/users" means
 * the same page, because every link in the sidebar is written as an absolute
 * /admin path — clicking one on this host would otherwise stack a second
 * prefix on. Both spellings resolve to one page.
 */
export function adminPathFor(pathname: string): string {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return pathname
  if (pathname === "/") return "/admin"
  return `/admin${pathname}`
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

/** Strip the port and normalise, the way a Host header arrives. */
export function hostOf(header: string | null): string | null {
  if (!header) return null
  return header.split(":")[0].toLowerCase().trim() || null
}

/**
 * The path this request should be served from.
 *
 * @param pathname  the path as requested
 * @param hostHeader  the raw Host header
 * @param adminHost  ADMIN_HOST, or undefined when the subdomain is off
 */
export function resolvePath(
  pathname: string,
  hostHeader: string | null,
  adminHost: string | undefined,
): string {
  const configured = adminHost?.toLowerCase().trim()
  if (!configured) return pathname
  if (hostOf(hostHeader) !== configured) return pathname
  if (isInfrastructure(pathname)) return pathname
  return adminPathFor(pathname)
}

/**
 * Only same-site paths survive the sign-in round-trip. "//evil.example" is a
 * protocol-relative URL, not a path, and is what an open redirect looks like.
 */
export function safeNext(next: string | null | undefined, fallback = "/admin"): string {
  if (!next) return fallback
  if (!next.startsWith("/")) return fallback
  if (next.startsWith("//")) return fallback
  if (next.startsWith("/\\")) return fallback
  return next
}
