import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { ConditionalLayout } from "@/components/conditional-layout"

const geistSans = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

/**
 * The casino's own info bar, for /obs/now-playing only.
 *
 * Not a taste call: the reference bar's strings were measured, and the size
 * that reproduces each one was solved for across six candidate faces. Inter's
 * three bold strings agree to within 0.3% on a single size, where the next best
 * is 3.2% and Geist is 4.7% — so the bar is set in Inter and the rest of the
 * site stays on Geist.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

/**
 * The site's name and the shape every page title takes.
 *
 * `template` is what each page fills in, so a page declares only its own name
 * and the brand is appended once, here. `default` covers anything that does
 * not declare one.
 *
 * The icon is app/icon.svg, which Next links by file convention; it is the
 * mark from the design canvas, the same four shapes the navigation draws.
 */
export const metadata: Metadata = {
  title: {
    default: "TrinidoRewards",
    template: "%s · TrinidoRewards",
  },
  description: "Rewards, leaderboards and bonus hunts for the TrinidoSlots community.",
  applicationName: "TrinidoRewards",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} ${inter.variable} bg-[#0B0B0D] antialiased`}>
        <NextTopLoader color="#22d3ee" height={2.5} shadow="0 0 10px rgba(34,211,238,0.6)" showSpinner={false} />
        <ConditionalLayout>{children}</ConditionalLayout>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
