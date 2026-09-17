import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { ConditionalLayout } from "@/components/conditional-layout"

const geistSans = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} bg-[#0B0B0D] antialiased`}>
        <NextTopLoader color="#22d3ee" height={2.5} shadow="0 0 10px rgba(34,211,238,0.6)" showSpinner={false} />
        <ConditionalLayout>{children}</ConditionalLayout>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
