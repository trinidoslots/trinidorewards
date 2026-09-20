import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { isAllowedAdmin } from "@/lib/admin-host"

/**
 * Establishes that the caller is an admin, for a route handler.
 *
 * The middleware only guards /admin *pages*; an API route under the same path
 * is reachable directly, so each one has to ask for itself. This is the check
 * /api/admin/users/[id] does inline, pulled out so that the routes which move
 * points cannot accidentally be written without it.
 *
 * Returns the admin's email on success so an action can record who took it.
 */
export type AdminAuth = { ok: true; email: string } | { ok: false; response: NextResponse }

export async function requireAdmin(): Promise<AdminAuth> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  // Signed in is not the same as allowed: sign-up is public. With ADMIN_EMAILS
  // unset this keeps the old behaviour rather than locking everyone out — the
  // same trade-off isAllowedAdmin documents.
  if (!isAllowedAdmin(user.email, process.env.ADMIN_EMAILS)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, email: user.email ?? "unknown" }
}
