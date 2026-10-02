"use client"

import { usePathname, useSelectedLayoutSegments } from "next/navigation"
import { panelPath } from "@/lib/admin-host"

/**
 * The panel's page as an /admin path, whichever host it is open on.
 *
 * On admin.trinidorewards.com the address bar says "/users" while the page
 * is /admin/users (the middleware rewrites it). The sidebar, the breadcrumbs
 * and the moderator rules all speak in /admin paths, so they read this rather
 * than usePathname(). Only for components that render inside the panel.
 */
export function useAdminPathname(): string {
  return panelPath(usePathname() ?? "/")
}

/**
 * Whether the page being shown is the admin panel.
 *
 * The address is not enough: on the admin host "/" is the panel's overview.
 * The route segments are the page that was actually matched, after the
 * middleware's rewrite, so they are right on both hosts and on the server's
 * first render as well as the client's.
 */
export function useInAdminPanel(): boolean {
  const pathname = usePathname() ?? "/"
  const segments = useSelectedLayoutSegments()
  return pathname.startsWith("/admin") || segments[0] === "admin"
}
