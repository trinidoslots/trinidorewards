import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { adminFromUser, type AdminIdentity } from "@/lib/admin-auth"

/**
 * Establishes who is calling an admin route handler.
 *
 * The middleware only guards /admin *pages*; an API route under the same path
 * is reachable directly, so each one has to ask for itself. There is exactly
 * one definition of staff: a verified Supabase session minted for a Kick
 * account that is tagged in admin_accounts (lib/admin-auth.ts).
 *
 *   requireAdmin() — admins only. Every route that has not been opened to
 *                    moderators on purpose, which is the safe default.
 *   requireStaff() — admins and moderators, for the routes behind the pages a
 *                    moderator may use (lib/admin-permissions.ts).
 *
 * `email` is kept as the name of the audit field routes already record ("who
 * took this action"). It now holds the admin's Kick name, since there is no
 * email login any more.
 */
export type AdminAuth =
  | ({ ok: true; email: string } & AdminIdentity)
  | { ok: false; response: NextResponse }

async function staff(): Promise<AdminAuth> {
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

export async function requireAdmin(): Promise<AdminAuth> {
  const auth = await staff()
  if (auth.ok && auth.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Admins only" }, { status: 403 }) }
  }
  return auth
}

export async function requireStaff(): Promise<AdminAuth> {
  return staff()
}
