"use client"

import { createContext, useContext } from "react"
import { usePathname } from "next/navigation"
import { Eye } from "lucide-react"
import { ACCENTS } from "@/components/ui/panel"
import { accessFor, type Access, type StaffRole } from "@/lib/admin-permissions"

/**
 * The signed-in staff member's role, for the admin UI.
 *
 * Set once by app/admin/layout.tsx from the verified session. It only decides
 * what the panel shows: hidden menu items, and edit buttons left out on the
 * pages a moderator may only look at. The database and API routes refuse
 * those writes regardless.
 */

const RoleContext = createContext<StaffRole>("admin")

export function AdminAccessProvider({ role, children }: { role: StaffRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useAdminAccess(): { role: StaffRole; access: Access | null; canEdit: boolean } {
  const role = useContext(RoleContext)
  const pathname = usePathname()
  const access = accessFor(role, pathname)
  return { role, access, canEdit: access === "edit" }
}

/** The strip at the top of a page a moderator can see but not change. */
export function ViewOnlyBanner() {
  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px]"
      style={{ borderColor: `${ACCENTS.blue}40`, backgroundColor: `${ACCENTS.blue}12`, color: ACCENTS.blue }}
    >
      <Eye className="h-3.5 w-3.5 shrink-0" />
      View only – moderators can look at this page but not change anything on it.
    </div>
  )
}
