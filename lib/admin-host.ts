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
 * Where an /admin request on the main site should go instead, or null.
 *
 * Opt-in (ADMIN_HOST_REDIRECT=true), so the admin host can be tried alongside
 * /admin first. Only the main site's own hosts are redirected: a Vercel
 * preview URL keeps its /admin, which is how a preview is tested.
 *
 * @param mainHosts  the main site's hosts, e.g. trinidorewards.com and www.
 */
export function adminHostRedirect(
  pathname: string,
  hostHeader: string | null,
  adminHost: string | undefined,
  enabled: boolean,
  mainHosts: string[],
): string | null {
  const configured = adminHost?.toLowerCase().trim()
  if (!enabled || !configured) return null
  const host = hostOf(hostHeader)
  if (!host || host === configured || !mainHosts.includes(host)) return null
  if (!isAdminPath(pathname)) return null
  const rest = pathname === "/admin" ? "/" : pathname.slice("/admin".length)
  return `https://${configured}${rest}`
}

/**
 * On the admin host, the panel's own address for an /admin path, or null.
 *
 * admin.trinidorewards.com/admin/users and /users are the same page; the
 * second is the one the panel links to, so the first is redirected to it and
 * there is one address per page. Off unless the move is switched on
 * (ADMIN_HOST_REDIRECT), and never on any other host.
 */
export function adminHostCanonical(
  pathname: string,
  hostHeader: string | null,
  adminHost: string | undefined,
  enabled: boolean,
): string | null {
  const configured = adminHost?.toLowerCase().trim()
  if (!enabled || !configured || hostOf(hostHeader) !== configured) return null
  if (!isAdminPath(pathname)) return null
  return pathname === "/admin" ? "/" : pathname.slice("/admin".length)
}

/**
 * Where the panel lives, for links: NEXT_PUBLIC_ADMIN_URL
 * (https://admin.trinidorewards.com), or null while it is under /admin.
 *
 * Set for production only. A preview has no admin host of its own, so
 * staging keeps every /admin link as it is.
 */
function adminBase(): string | null {
  const value = process.env.NEXT_PUBLIC_ADMIN_URL?.trim().replace(/\/+$/, "")
  return value || null
}

/**
 * An /admin path as the panel links to it.
 *
 * Everything in the panel is written as /admin/..., the form the moderator
 * rules and the sidebar use. With the admin host on, the prefix comes off at
 * the link: "/admin/users" becomes "/users", "/admin" becomes "/". Anything
 * that is not an /admin path comes back untouched, so wrapping twice is safe.
 */
export function adminHref(path: string): string {
  if (!adminBase()) return path
  const bare = path.split(/[?#]/)[0]
  if (!isAdminPath(bare)) return path
  const rest = path.slice("/admin".length)
  return rest === "" || rest.startsWith("?") || rest.startsWith("#") ? `/${rest}` : rest
}

/** The panel's full address, for a link from the public site. */
export function adminUrl(path = "/admin"): string {
  const base = adminBase()
  return base ? `${base}${adminHref(path)}` : path
}

/** The /admin path for an address in the panel; the reverse of adminHref. */
export function panelPath(pathname: string): string {
  return adminBase() ? adminPathFor(pathname) : pathname
}

/** The main site's hosts, from NEXT_PUBLIC_SITE_URL: the host and its www twin. */
export function mainSiteHosts(siteUrl: string | undefined): string[] {
  try {
    const host = new URL(siteUrl ?? "").hostname.toLowerCase()
    const bare = host.replace(/^www\./, "")
    return [bare, `www.${bare}`]
  } catch {
    return []
  }
}

/**
 * Only same-site paths survive the sign-in round-trip. "//evil.example" is a
 * protocol-relative URL, not a path, and is what an open redirect looks like.
 *
 * URL parsers drop tabs and newlines and read "\" as "/", so "/<tab>/evil.example"
 * passes a prefix check and still lands on evil.example. Those characters are
 * refused anywhere in the value, and the result must resolve to this origin.
 */
export function safeNext(next: string | null | undefined, fallback = "/admin"): string {
  if (!next) return fallback
  if (!next.startsWith("/")) return fallback
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback
  if (next.startsWith("//")) return fallback
  try {
    if (new URL(next, "https://same.invalid").origin !== "https://same.invalid") return fallback
  } catch {
    return fallback
  }
  return next
}
