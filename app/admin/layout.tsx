import type React from "react"
import type { Metadata } from "next"
import { AdminShell } from "@/components/admin-shell"
import { createServerClient } from "@/lib/supabase/server"
import { adminFromUser } from "@/lib/admin-auth"

/**
 * A server layout so the admin section can carry a title, and so the panel
 * knows whether it is showing an admin or a moderator.
 *
 * Metadata can only be exported from a server component, and this layout used
 * to be the client one — it holds sidebar state and a page transition. That
 * part moved to components/admin-shell.tsx unchanged; this is the server shell
 * around it.
 *
 * The role is read from the same verified session the middleware already
 * checked. If it cannot be read the panel shows the moderator view, the
 * narrower of the two; the middleware and the database decide access anyway.
 *
 * Each admin route overrides the title from its own layout.
 */
export const metadata: Metadata = {
  title: "Admin",
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const staff = await adminFromUser(user)

  return <AdminShell role={staff?.role ?? "moderator"}>{children}</AdminShell>
}
