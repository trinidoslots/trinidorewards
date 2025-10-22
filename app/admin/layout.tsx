"use client"

import type React from "react"
import AdminSidebar from "@/components/admin-sidebar"
import { useState, useEffect } from "react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  // Listen for sidebar collapse events
  useEffect(() => {
    const handleCollapse = (e: CustomEvent) => {
      setCollapsed(e.detail.collapsed)
    }

    window.addEventListener("sidebarCollapse" as any, handleCollapse)
    return () => window.removeEventListener("sidebarCollapse" as any, handleCollapse)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AdminSidebar onCollapse={setCollapsed} />
      <div className={`p-3 transition-all duration-300 ${collapsed ? "ml-14" : "ml-56"}`}>
        <div className="container mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  )
}
