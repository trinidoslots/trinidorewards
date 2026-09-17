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
    <div className="min-h-screen bg-[#0B0B0D]">
      <AdminSidebar onCollapse={setCollapsed} />
      <div className={`p-5 transition-all duration-300 ${collapsed ? "ml-14" : "ml-56"}`}>
        <div className="container mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  )
}
