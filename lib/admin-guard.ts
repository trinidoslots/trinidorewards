import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { adminFromUser, type AdminIdentity } from "@/lib/admin-auth"

/**
 * Establishes that the caller is an admin, for a route handler.
 *
 * The middleware only guards /admin *pages*; an API route under the same path
 * is reachable directly, so each one has to ask for itself. Every admin route
 * goes through this one function, so there is exactly one definition of
 * "admin": a verified Supabase session minted for a Kick account that is
 * tagged in admin_accounts (lib/admin-auth.ts).
 *
 * `email` is kept as the name of the audit field routes already record ("who
 * took this action"). It now holds the admin's Kick name, since there is no
 * email login any more.
 */
export type AdminAuth =
  | ({ ok: true; email: string } & AdminIdentity)
  | { ok: false; response: NextResponse }

export async function requireAdmin(): Promise<AdminAuth> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const admin = await adminFromUser(user)
  if (!admin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, email: admin.username ? `kick:${admin.username}` : `kick:${admin.kickId}`, ...admin }
}
