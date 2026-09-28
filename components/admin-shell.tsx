"use client"

import type React from "react"
import AdminSidebar from "@/components/admin-sidebar"
import { AdminTopBar } from "@/components/admin-top-bar"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { AdminAccessProvider, ViewOnlyBanner } from "@/components/admin-access"
import { accessFor, type StaffRole } from "@/lib/admin-permissions"

export function AdminShell({
  role,
  children,
}: {
  role: StaffRole
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const viewOnly = accessFor(role, pathname) === "view"

  // On <body>, so it reaches dialogs portalled out of the page too. See globals.css.
  useEffect(() => {
    document.body.classList.toggle("admin-view-only", viewOnly)
    return () => document.body.classList.remove("admin-view-only")
  }, [viewOnly])

  // Listen for sidebar collapse events
  useEffect(() => {
    const handleCollapse = (e: CustomEvent) => {
      setCollapsed(e.detail.collapsed)
    }

    window.addEventListener("sidebarCollapse" as any, handleCollapse)
    return () => window.removeEventListener("sidebarCollapse" as any, handleCollapse)
  }, [])

  return (
    <AdminAccessProvider role={role}>
    <div className="min-h-screen bg-[#0B0B0D]">
      <AdminSidebar onCollapse={setCollapsed} role={role} />
      <div className={`transition-all duration-300 ${collapsed ? "ml-14" : "ml-56"}`}>
        {/* Beside the sidebar, never over it, and level with its header row. */}
        <AdminTopBar />
        <div className="p-5">
        {/*
          The page switch is marked here, around the content, and never around
          the sidebar — a transform on a shared ancestor would take the fixed
          sidebar with it.

          Opacity only, no movement. Several admin screens open their overlays
          as plain `fixed inset-0` children rather than through a portal, and a
          transform on this wrapper would re-anchor those to it: a modal opened
          mid-transition would sit inside the content column instead of over
          the page. Fading has no containing block of its own, so it cannot.
        */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
          className="container mx-auto max-w-7xl"
        >
          {viewOnly && <ViewOnlyBanner />}
          {children}
        </motion.div>
        </div>
      </div>
    </div>
    </AdminAccessProvider>
  )
}
