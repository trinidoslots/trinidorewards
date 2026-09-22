import type React from "react"
import type { Metadata } from "next"
import { AdminShell } from "@/components/admin-shell"

/**
 * A server layout so the admin section can carry a title.
 *
 * Metadata can only be exported from a server component, and this layout used
 * to be the client one — it holds sidebar state and a page transition. That
 * part moved to components/admin-shell.tsx unchanged; this is the server shell
 * around it, which exists to name the section.
 *
 * Each admin route overrides the title from its own layout.
 */
export const metadata: Metadata = {
  title: "Admin",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
