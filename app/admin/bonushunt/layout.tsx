import type React from "react"
import type { Metadata } from "next"

// The page is a client component and cannot carry metadata itself.
export const metadata: Metadata = {
  title: "Bonus hunt · Admin",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
