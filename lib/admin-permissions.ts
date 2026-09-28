/**
 * What each staff role may open in the admin panel.
 *
 * Kept free of server imports so the middleware, the sidebar and the pages
 * can all read the same list. This is the *navigation* half of the rules; the
 * database (scripts/076: is_admin() / is_moderator() and their policies) and
 * the API routes (lib/admin-guard.ts) enforce the same thing independently, so
 * a moderator who types a hidden URL or calls the database from the console
 * gets nothing either way.
 */

export type StaffRole = "admin" | "moderator"

/** A page a moderator can use ("edit") or only look at ("view"). */
export type Access = "edit" | "view"

type Rule = { path: string; access: Access; exact?: boolean }

const MODERATOR_RULES: Rule[] = [
  { path: "/admin/obs/now-playing", access: "edit" },
  { path: "/admin/predictions", access: "edit" },
  { path: "/admin/settings", access: "edit" },
  { path: "/admin/tournaments", access: "edit" },
  { path: "/admin/bonushunt/opening", access: "edit" },

  { path: "/admin/leaderboards", access: "view", exact: true },
  { path: "/admin/leaderboards/overview", access: "view" },
  { path: "/admin/leaderboards/manage", access: "view" },
  { path: "/admin/giveaway", access: "view" },
  { path: "/admin/raffles/active", access: "view" },
  { path: "/admin/raffles/history", access: "view" },
  { path: "/admin/promo-codes", access: "view" },
  // The items list only: redemptions carry people's payout details.
  { path: "/admin/store", access: "view", exact: true },
]

/** Where a moderator lands when they open /admin or a page they may not see. */
export const MODERATOR_HOME = "/admin/obs/now-playing"

/** What `role` may do on `pathname`: full, read-only, or nothing (null). */
export function accessFor(role: StaffRole, pathname: string): Access | null {
  if (role === "admin") return "edit"
  const path = pathname.replace(/\/+$/, "") || "/"
  const rule = MODERATOR_RULES.find((entry) =>
    entry.exact ? path === entry.path : path === entry.path || path.startsWith(`${entry.path}/`),
  )
  return rule?.access ?? null
}

export const ROLE_LABELS: Record<StaffRole, string> = { admin: "Admin", moderator: "Moderator" }
