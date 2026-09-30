import type React from "react"
import type { Metadata } from "next"

// The pages are client components and cannot carry metadata themselves.
export const metadata: Metadata = {
  title: "Challenges · Admin",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
